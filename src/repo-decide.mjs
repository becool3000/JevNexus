import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { defaultQuery, packageRoot, repoRoot } from "./config.mjs";
import { compactContextPreview } from "./context-reducer.mjs";
import { createColdStructuredSource } from "./gitnexus-mcp.mjs";
import { collectEvidence } from "./evidence-collector.mjs";
import { decide } from "./jev.mjs";

function assertCurrentEvidence(collected) {
  if (collected.state.repository.dirty) {
    const error = new Error("JevNexus decisions require a clean target repository checkout.");
    error.code = "GITNEXUS_REPOSITORY_DIRTY";
    throw error;
  }
  if (collected.state.retrieval.sourceChangedDuringCollection) {
    const error = new Error("The repository changed while JevNexus was collecting source evidence. Retry after reviewing the working tree.");
    error.code = "GITNEXUS_SOURCE_CHANGED";
    throw error;
  }
  if (collected.state.retrieval.freshness !== "current") {
    const error = new Error("GitNexus index and source snapshot must match, and the repository must be clean, before Jev can decide.");
    error.code = "GITNEXUS_INDEX_STALE";
    throw error;
  }
}

async function saveDiagnostic(payload) {
  const directory = path.join(packageRoot, "artifacts", "evidence");
  await fs.mkdir(directory, { recursive: true });
  const name = `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}.json`;
  const target = path.join(directory, name);
  const temporary = `${target}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
  await fs.rename(temporary, target);
  return path.relative(packageRoot, target).replaceAll("\\", "/");
}

export async function collectContext(question = defaultQuery, {
  source = createColdStructuredSource(),
  queryLimit = 5,
  searchLimit = 3,
  expansionLimit = 6,
  graphDepth = 1,
  maxEvidenceChars,
} = {}) {
  return collectEvidence(question, { source, queryLimit, searchLimit, expansionLimit, graphDepth, maxEvidenceChars });
}

export async function repoEvidence(question = defaultQuery, {
  source = createColdStructuredSource(),
  queryLimit = 5,
  searchLimit = 3,
  expansionLimit = 6,
  graphDepth = 1,
  maxEvidenceChars,
  recordDiagnostics = false,
} = {}) {
  const collected = await collectContext(question, { source, queryLimit, searchLimit, expansionLimit, graphDepth, maxEvidenceChars });
  const result = {
    ok: true,
    evidenceBundleHash: collected.state.evidenceBundleHash,
    metrics: collected.metrics,
    context: compactContextPreview(collected.state),
  };
  if (recordDiagnostics) {
    result.diagnosticPath = await saveDiagnostic({
      kind: "evidence-preview",
      question,
      source: collected.raw,
      selected: collected.state,
      metrics: collected.metrics,
    });
  }
  return result;
}

export async function repoDecide(question = defaultQuery, choices, decisionType, {
  source = createColdStructuredSource(),
  queryLimit = 5,
  searchLimit = 3,
  expansionLimit = 6,
  graphDepth = 1,
  maxEvidenceChars,
  includeContext = false,
  recordDiagnostics = false,
} = {}) {
  const started = performance.now();
  const collected = await collectContext(question, { source, queryLimit, searchLimit, expansionLimit, graphDepth, maxEvidenceChars });
  if (recordDiagnostics) {
    // Preserve retrieval evidence even if freshness validation or Jev later fails.
    var diagnostic = await saveDiagnostic({
      kind: "repository-decision-input",
      question,
      source: collected.raw,
      selected: collected.state,
      metrics: collected.metrics,
    });
  }
  assertCurrentEvidence(collected);
  const decisionStarted = performance.now();
  const response = await decide(collected.state, { question, choices, decisionType });
  const jevMs = performance.now() - decisionStarted;
  const metrics = {
    ...collected.metrics,
    jevMs,
    totalMs: performance.now() - started,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    repositoryContextChars: collected.metrics.rawEvidenceChars,
    jevInputContextChars: collected.metrics.selectedEvidenceChars,
    codexVisibleContextChars: includeContext ? collected.metrics.selectedEvidenceChars : 0,
    contextKeptAwayFromCodexChars: includeContext
      ? Math.max(0, collected.metrics.rawEvidenceChars - collected.metrics.selectedEvidenceChars)
      : collected.metrics.rawEvidenceChars,
  };
  const result = {
    ok: true,
    decision: response.answers.decision,
    model: response.model,
    metrics,
  };
  if (includeContext) result.context = compactContextPreview(collected.state);
  if (diagnostic) {
    result.diagnosticPath = diagnostic;
    await saveDiagnostic({
      kind: "repository-decision-result",
      question,
      diagnosticPath: diagnostic,
      result,
    });
  }
  return result;
}

export function describeArchitecture() {
  return `Codex -> repo_decide -> GitNexus structured evidence collector -> deterministic reducer -> Jev (${repoRoot})`;
}
