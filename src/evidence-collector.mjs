import { performance } from "node:perf_hooks";
import { DEFAULT_EVIDENCE_CHARS, reduceEvidence, scoreCandidate, validateReducedContext } from "./context-reducer.mjs";

const MAX_SEARCHES = 3;
const MAX_EXPANSIONS = 6;
const MAX_HOPS = 1;
const MAX_CONCURRENCY = 2;
const STOP_WORDS = new Set("a an and are as at be between by for from how in into is of on or should that the their then this to understand use using what which with where playable area inspect first already final".split(" "));
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function elapsed(start) { return performance.now() - start; }

function extractCandidateObjects(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) extractCandidateObjects(item, result);
    return result;
  }
  const hasIdentity = (value.id || value.uid || value.name) && (value.filePath || value.path || value.kind || value.type || value.content);
  if (hasIdentity) result.push(value);
  for (const [key, child] of Object.entries(value)) {
    if (["processes", "process_symbols", "definitions", "symbols", "matches", "results", "items"].includes(key)) {
      extractCandidateObjects(child, result);
    }
  }
  return result;
}

function asArray(value) { return Array.isArray(value) ? value : []; }

function makeCandidate(raw, provenance = "search") {
  const filePath = raw.filePath ?? raw.path ?? raw.file_path ?? raw.file ?? null;
  const id = raw.uid ?? raw.id ?? `${filePath ?? "?"}:${raw.startLine ?? raw.start_line ?? 0}:${raw.name ?? "?"}`;
  return {
    id: String(id),
    uid: raw.uid ?? raw.id ?? null,
    name: raw.name ?? raw.symbol ?? "(unnamed symbol)",
    kind: raw.kind ?? raw.type ?? raw.symbolType ?? String(raw.uid ?? raw.id ?? "").split(":")[0] ?? null,
    filePath,
    startLine: raw.startLine ?? raw.start_line ?? raw.line ?? null,
    endLine: raw.endLine ?? raw.end_line ?? null,
    summary: raw.summary ?? raw.description ?? raw.signature ?? null,
    content: raw.content ?? raw.source ?? raw.code ?? null,
    relevance: Number(raw.relevance ?? raw.score ?? raw.rank ?? 0),
    provenance: [provenance],
    relationships: [],
  };
}

function mergeCandidate(map, candidate) {
  const existing = map.get(candidate.id);
  if (!existing) { map.set(candidate.id, candidate); return candidate; }
  if (!existing.provenance.includes(candidate.provenance[0])) existing.relevance += candidate.relevance;
  existing.provenance = [...new Set([...existing.provenance, ...candidate.provenance])].sort();
  if (!existing.content && candidate.content) existing.content = candidate.content;
  if (!existing.summary && candidate.summary) existing.summary = candidate.summary;
  return existing;
}

function contextParts(raw) {
  const symbol = raw?.symbol ?? raw?.target ?? raw?.definition ?? raw;
  const relations = [];
  for (const [key, direction] of [["callers", "caller"], ["callees", "callee"], ["relationships", "related"]]) {
    for (const relation of asArray(raw?.[key])) relations.push({ ...relation, direction: relation.direction ?? direction });
  }
  for (const [key, direction] of [["incoming", "caller"], ["outgoing", "callee"]]) {
    for (const [kind, values] of Object.entries(raw?.[key] ?? {})) {
      if (kind !== "calls") continue;
      for (const relation of asArray(values)) relations.push({ ...relation, direction, kind });
    }
  }
  return { symbol, relations };
}

function mergeContext(map, raw, requested) {
  const { symbol, relations } = contextParts(raw);
  const target = makeCandidate(symbol, `context:${requested.id}`);
  const current = mergeCandidate(map, target);
  for (const relation of relations) {
    const normalized = makeCandidate(relation, `graph:${relation.direction ?? "related"}`);
    current.relationships.push({
      id: normalized.id,
      uid: normalized.uid,
      name: normalized.name,
      kind: normalized.kind,
      filePath: normalized.filePath,
      startLine: normalized.startLine,
      content: normalized.content,
      direction: relation.direction ?? "related",
    });
    // Graph expansion is exactly one hop: neighbors are retained as relationship evidence,
    // and are not recursively queried for their own context.
  }
  current.relationships = [...new Map(current.relationships.map((item) => [
    `${item.direction}:${item.id}`, item,
  ])).values()];
}

function queryVariants(question, candidates) {
  const words = question.toLowerCase().match(/[a-z][a-z0-9_]{2,}/g) ?? [];
  const terms = [...new Set(words.filter((word) => !STOP_WORDS.has(word)))].slice(0, 12);
  const anchors = candidates.slice(0, 4).map((item) => item.name).filter(Boolean);
  const variants = [];
  if (anchors.length) variants.push([...new Set([...terms.slice(0, 4), ...anchors])].join(" "));
  const tail = terms.slice(Math.max(0, terms.length - 6));
  if (tail.length) variants.push(`${tail.join(" ")} callers callees implementation`);
  return [...new Set(variants)].filter((query) => query.trim() && query !== question).slice(0, MAX_SEARCHES - 1);
}

async function mapBounded(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = { status: "fulfilled", value: await mapper(items[index], index) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function collectEvidence(question, {
  source,
  queryLimit = 5,
  searchLimit = MAX_SEARCHES,
  expansionLimit = MAX_EXPANSIONS,
  graphDepth = MAX_HOPS,
  concurrency = MAX_CONCURRENCY,
  maxEvidenceChars = DEFAULT_EVIDENCE_CHARS,
} = {}) {
  if (!source) throw new Error("An evidence source is required.");
  if (searchLimit < 1 || searchLimit > MAX_SEARCHES || expansionLimit < 0 || expansionLimit > MAX_EXPANSIONS || graphDepth < 0 || graphDepth > MAX_HOPS ||
      !Number.isInteger(queryLimit) || queryLimit < 1 || queryLimit > 10 || !Number.isInteger(maxEvidenceChars ?? DEFAULT_EVIDENCE_CHARS) ||
      (maxEvidenceChars ?? DEFAULT_EVIDENCE_CHARS) < 1000 || (maxEvidenceChars ?? DEFAULT_EVIDENCE_CHARS) > 100000) {
    throw Object.assign(new Error("Evidence limits exceed the supported search, expansion, or graph-depth bounds."), { code: "INVALID_EVIDENCE_LIMIT" });
  }
  const started = performance.now();
  const statusStarted = performance.now();
  const [indexStatus, snapshot] = await Promise.all([source.status(), source.sourceSnapshot?.() ?? null]);
  const statusMs = elapsed(statusStarted);
  const searches = [];
  const failures = [];
  const candidateMap = new Map();
  let queryDurationTotal = 0;
  const rawSearchResults = [];

  const fetchSearch = async (queryText, ordinal) => {
    const began = performance.now();
    try {
      const result = await source.query(queryText, queryLimit, { includeContent: false });
      return { ordinal, query: queryText, result, ms: elapsed(began) };
    } catch (error) {
      return { ordinal, query: queryText, error, ms: elapsed(began) };
    }
  };

  const gatherSearch = (proposal) => {
    queryDurationTotal += proposal.ms;
    if (proposal.error) {
      searches.push({ ordinal: proposal.ordinal, query: proposal.query, candidateCount: 0, truncated: false });
      failures.push({ stage: "search", ordinal: proposal.ordinal, code: proposal.error.code ?? "GITNEXUS_QUERY_FAILED", reason: proposal.error.message });
      return;
    }
    const { result, ordinal, query: queryText } = proposal;
    rawSearchResults[ordinal] = result;
    const found = extractCandidateObjects(result);
    searches.push({ ordinal, query: queryText, candidateCount: found.length, truncated: Boolean(result?._transportTruncated) });
    for (let rank = 0; rank < found.length; rank += 1) {
      const candidate = makeCandidate(found[rank], `search:${ordinal}`);
      const searchWeight = ordinal === 0 ? 1 : 0.25;
      candidate.relevance = Number(found[rank].relevance ?? found[rank].score ?? 0) + searchWeight / (rank + 1);
      mergeCandidate(candidateMap, candidate);
    }
    if (result?._transportTruncated) failures.push({ stage: "search", ordinal, reason: "transport-truncated" });
  };

  const primary = await fetchSearch(question, 0);
  gatherSearch(primary);
  const variants = queryVariants(question, [...candidateMap.values()]).slice(0, searchLimit - 1);
  const secondary = await mapBounded(variants, Math.min(concurrency, MAX_CONCURRENCY), (queryText, index) => fetchSearch(queryText, index + 1));
  for (const item of secondary) {
    if (item.status === "fulfilled") gatherSearch(item.value);
    else failures.push({ stage: "search-scheduler", reason: String(item.reason?.message ?? item.reason) });
  }
  searches.sort((a, b) => a.ordinal - b.ordinal);

  const rankedForExpansion = [...candidateMap.values()].sort((a, b) => scoreCandidate(b, question) - scoreCandidate(a, question) || compareText(a.id, b.id));
  const expansionCandidates = rankedForExpansion.slice(0, expansionLimit);
  const expansionStarted = performance.now();
  const expansions = await mapBounded(expansionCandidates, Math.min(concurrency, MAX_CONCURRENCY), async (candidate) => {
    const began = performance.now();
    const context = await source.context(candidate);
    return { candidate, context, ms: elapsed(began), truncated: Boolean(context?._transportTruncated) };
  });
  let contextMs = elapsed(expansionStarted);
  let expansionCount = 0;
  const rawContexts = [];
  for (let index = 0; index < expansions.length; index += 1) {
    const result = expansions[index];
    if (result.status === "rejected") {
      failures.push({ stage: "context", id: expansionCandidates[index]?.id ?? null, reason: String(result.reason?.message ?? result.reason) });
      continue;
    }
    expansionCount += 1;
    rawContexts.push({ requestedId: result.value.candidate.id, context: result.value.context });
    if (result.value.context?.status && result.value.context.status !== "found") {
      failures.push({ stage: "context", id: result.value.candidate.id, reason: `symbol-${result.value.context.status}` });
      continue;
    }
    mergeContext(candidateMap, result.value.context, result.value.candidate);
    if (result.value.truncated) failures.push({ stage: "context", id: result.value.candidate.id, reason: "transport-truncated" });
  }

  const snapshotAfter = await source.sourceSnapshot?.() ?? snapshot;
  const sourceChangedDuringCollection = Boolean(snapshot && snapshotAfter && (
    snapshot.head !== snapshotAfter.head || snapshot.dirty !== snapshotAfter.dirty || snapshot.dirtyDigest !== snapshotAfter.dirtyDigest
  ));
  const statusData = indexStatus?.data ?? indexStatus;
  const indexedCommit = statusData?.index?.commit ?? statusData?.commit ?? null;
  const freshness = !snapshot?.head ? "unknown" : indexedCommit === snapshot.head && !snapshot.dirty ? "current" : "stale-or-dirty";
  const candidates = [...candidateMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  const rawChars = JSON.stringify({ searches, candidates, failures }).length;
  const retrieval = {
    bounds: { searches: searchLimit, expansions: expansionLimit, graphDepth, concurrency: Math.min(concurrency, MAX_CONCURRENCY), evidenceChars: maxEvidenceChars },
    searches,
    searchCount: searches.length,
    expansionCount,
    candidateCount: candidates.length,
    failures,
    incomplete: failures.length > 0 || sourceChangedDuringCollection || expansionCount < expansionCandidates.length,
    freshness,
    indexedCommit,
    sourceChangedDuringCollection,
    rawRetrievedTokenEstimate: Math.ceil(rawChars / 2.5),
  };
  const selectionStarted = performance.now();
  const state = validateReducedContext(reduceEvidence({ question, snapshot, status: indexStatus, candidates, retrieval, maxEvidenceChars }));
  const selectionMs = elapsed(selectionStarted);
  const rawEvidenceChars = rawChars;
  const selectedEvidenceChars = JSON.stringify(state.evidence).length;
  return {
    state,
    raw: { indexStatus, snapshot, searches: rawSearchResults, contexts: rawContexts, candidates },
    metrics: {
      source: source.kind,
      warm: Boolean(source.warm),
      statusMs,
      gitnexusQueryMs: queryDurationTotal,
      gitnexusSearchMs: queryDurationTotal,
      contextMs,
      selectionMs,
      collectionMs: elapsed(started),
      rawEvidenceChars,
      selectedEvidenceChars,
      estimatedInputTokens: Math.ceil(selectedEvidenceChars / 2.5),
      trackedFileCount: (await source.trackedFiles?.())?.length ?? null,
      searchCount: searches.length,
      expansionCount,
      sourceChangedDuringCollection,
      freshness,
    },
  };
}

export const evidenceLimits = Object.freeze({ maxSearches: MAX_SEARCHES, maxExpansions: MAX_EXPANSIONS, maxGraphDepth: MAX_HOPS, maxConcurrency: MAX_CONCURRENCY });
