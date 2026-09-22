import { performance } from "node:perf_hooks";
import { defaultQuery, repoRoot } from "./config.mjs";
import { compactContextPreview, reduceContext, validateReducedContext } from "./context-reducer.mjs";
import { createColdSource } from "./gitnexus.mjs";
import { decide } from "./jev.mjs";

export async function collectContext(question = defaultQuery, {
  source = createColdSource(),
  queryLimit = 5,
} = {}) {
  const started = performance.now();
  const statusStarted = performance.now();
  const indexStatus = await source.status();
  const statusMs = performance.now() - statusStarted;
  const queryStarted = performance.now();
  const queryResult = await source.query(question, queryLimit);
  const queryMs = performance.now() - queryStarted;
  const files = await source.trackedFiles();
  const rawContext = { question, indexStatus, queryResult, files };
  const reducerStarted = performance.now();
  const state = validateReducedContext(reduceContext({
    question,
    status: indexStatus,
    queryResult,
    files,
  }));
  const reducerMs = performance.now() - reducerStarted;
  const rawContextChars = JSON.stringify(rawContext).length;
  const reducedStateChars = JSON.stringify(state).length;
  return {
    state,
    metrics: {
      source: source.kind,
      warm: Boolean(source.warm),
      statusMs,
      gitnexusQueryMs: queryMs,
      reducerMs,
      collectionMs: performance.now() - started,
      rawContextChars,
      reducedStateChars,
      contextKeptAwayChars: Math.max(0, rawContextChars - reducedStateChars),
      trackedFileCount: files.length,
    },
  };
}

export async function repoDecide(question = defaultQuery, choices, decisionType, {
  source = createColdSource(),
  queryLimit = 5,
  includeContext = false,
} = {}) {
  const started = performance.now();
  const collected = await collectContext(question, { source, queryLimit });
  const decisionStarted = performance.now();
  const response = await decide(collected.state, { question, choices, decisionType });
  const jevMs = performance.now() - decisionStarted;
  const metrics = {
    ...collected.metrics,
    jevMs,
    totalMs: performance.now() - started,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    repositoryContextChars: collected.metrics.rawContextChars,
    jevInputContextChars: collected.metrics.reducedStateChars,
    codexVisibleContextChars: includeContext ? collected.metrics.reducedStateChars : 0,
    contextKeptAwayFromCodexChars: includeContext
      ? Math.max(0, collected.metrics.rawContextChars - collected.metrics.reducedStateChars)
      : collected.metrics.rawContextChars,
  };
  const result = {
    ok: true,
    decision: response.answers.decision,
    model: response.model,
    metrics,
  };
  if (includeContext) result.context = compactContextPreview(collected.state);
  return result;
}

export function describeArchitecture() {
  return `Codex -> repo_decide -> warm GitNexus -> bounded reducer -> Jev -> typed result (${repoRoot})`;
}
