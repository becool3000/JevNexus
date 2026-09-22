import { performance } from "node:perf_hooks";
import { defaultQuery } from "./config.mjs";
import { reduceContext, validateReducedContext } from "./context-reducer.mjs";
import { decide } from "./jev.mjs";
import { query, status, trackedFiles } from "./gitnexus.mjs";

export function collectContext(question = defaultQuery) {
  const started = performance.now();
  const indexStarted = performance.now();
  const indexStatus = status();
  const indexMs = performance.now() - indexStarted;
  const queryStarted = performance.now();
  const queryResult = query(question);
  const queryMs = performance.now() - queryStarted;
  const state = validateReducedContext(reduceContext({
    question,
    status: indexStatus,
    queryResult,
    files: trackedFiles(),
  }));
  return {
    state,
    collection: {
      totalMs: performance.now() - started,
      indexMs,
      queryMs,
      reducedStateChars: JSON.stringify(state).length,
    },
  };
}

export async function repoDecide(question = defaultQuery) {
  const started = performance.now();
  const collected = collectContext(question);
  const decisionStarted = performance.now();
  const response = await decide(collected.state);
  const decisionMs = performance.now() - decisionStarted;
  return {
    ok: true,
    architecture: "Codex -> repo_decide -> GitNexus/context reducer -> Jev -> structured decision",
    decision: response.answers,
    usage: response.usage ?? null,
    timingsMs: {
      ...collected.collection,
      jevMs: decisionMs,
      endToEndMs: performance.now() - started,
    },
    gitnexus: collected.state.gitnexus,
    stateSummary: {
      fileCount: collected.state.repository.fileCount,
      evidenceChars: JSON.stringify(collected.state.searchEvidence).length,
    },
  };
}
