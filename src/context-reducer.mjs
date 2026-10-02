import { createHash } from "node:crypto";

const DEFAULT_EVIDENCE_CHARS = 24_000;
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function compactStatus(status) {
  const data = status?.data ?? status;
  const index = data?.index ?? {};
  return {
    indexed: Boolean(data?.indexed ?? data?.exists ?? (data?.status === "ready" || data?.status === "up-to-date")),
    repo: data?.repo ?? data?.name ?? data?.repository ?? null,
    commit: index?.commit ?? data?.commit ?? null,
    symbols: data?.symbols ?? data?.symbolCount ?? null,
    relationships: data?.relationships ?? data?.relationshipCount ?? null,
  };
}

function candidateKey(candidate) {
  return String(candidate.id ?? candidate.uid ?? `${candidate.filePath ?? "?"}:${candidate.startLine ?? 0}:${candidate.name ?? "?"}`);
}

function tokens(value) {
  return new Set(String(value ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

export function scoreCandidate(candidate, question) {
  const queryTerms = tokens(question);
  const identityTerms = tokens(`${candidate.name ?? ""} ${candidate.filePath ?? candidate.path ?? ""}`);
  let identityMatches = 0;
  for (const term of queryTerms) if (identityTerms.has(term)) identityMatches += 1;
  const contentTerms = tokens(candidate.content);
  let contentMatches = 0;
  for (const term of queryTerms) if (contentTerms.has(term)) contentMatches += 1;
  const questionTerms = [...queryTerms];
  const asksAboutTests = questionTerms.some((term) => ["test", "tests", "testing", "regression", "fixture"].includes(term));
  const isFileNode = String(candidate.kind ?? "").toLowerCase() === "file" || String(candidate.id ?? "").startsWith("File:");
  const isTestFile = /(^|[/\\])(tests?|testing)([/\\]|$)/i.test(candidate.filePath ?? candidate.path ?? "");
  const penalties = (isFileNode ? 0.75 : 0) + (isTestFile && !asksAboutTests ? 0.55 : 0);
  return Number(candidate.relevance ?? candidate.score ?? 0) + identityMatches * 0.12 + Math.min(0.04, contentMatches * 0.002) +
    Math.min(0.08, (candidate.provenance?.length ?? 0) * 0.02) - penalties;
}

function rankCandidates(candidates, question) {
  return [...candidates].sort((a, b) => scoreCandidate(b, question) - scoreCandidate(a, question) || compareText(candidateKey(a), candidateKey(b)));
}

function evidenceBlock(candidate, question) {
  return {
    id: candidateKey(candidate),
    name: candidate.name ?? "(unnamed symbol)",
    kind: candidate.kind ?? candidate.type ?? null,
    path: candidate.filePath ?? candidate.path ?? null,
    startLine: candidate.startLine ?? null,
    endLine: candidate.endLine ?? null,
    responsibility: candidate.summary ?? candidate.description ?? null,
    relevance: Number(scoreCandidate(candidate, question).toFixed(6)),
    content: candidate.content ?? null,
    relationships: (candidate.relationships ?? []).map((relationship) => ({
      direction: relationship.direction,
      kind: relationship.kind ?? relationship.type ?? null,
      id: relationship.id ?? relationship.uid ?? null,
      name: relationship.name ?? null,
      path: relationship.filePath ?? relationship.path ?? null,
      startLine: relationship.startLine ?? null,
      content: relationship.content ?? null,
    })).sort((a, b) => compareText(`${a.direction}:${a.id ?? a.name}`, `${b.direction}:${b.id ?? b.name}`)),
    provenance: [...new Set(candidate.provenance ?? [])].sort(),
  };
}

export function reduceEvidence({ question, snapshot, status, candidates, retrieval, maxEvidenceChars = DEFAULT_EVIDENCE_CHARS }) {
  const ranked = rankCandidates(candidates, question);
  const selected = [];
  const omissions = [];
  for (const candidate of ranked) {
    const block = evidenceBlock(candidate, question);
    const blockChars = stableJson(block).length;
    selected.push(block);
  }

  let omittedCount = 0;
  const makeBody = () => {
    const omissionsPreview = omissions.slice(0, 12);
    return {
      schemaVersion: 1,
      task: question,
      repository: {
        name: compactStatus(status).repo,
        revision: snapshot?.head ?? compactStatus(status).commit,
        dirty: Boolean(snapshot?.dirty),
        dirtyDigest: snapshot?.dirty ? snapshot?.dirtyDigest ?? null : null,
      },
      index: compactStatus(status),
      retrieval,
      evidence: { candidates: selected, omissions: omissionsPreview, omittedCount },
      coverage: {
        candidateCount: candidates.length,
        selectedCount: selected.length,
        omissionCount: omittedCount,
        hasSourceContent: selected.some((item) => Boolean(item.content)),
        hasRelationships: selected.some((item) => item.relationships.length > 0),
        incomplete: Boolean(retrieval.incomplete || omittedCount),
      },
    };
  };
  for (const candidate of ranked.slice().reverse()) {
    // The limit applies to the complete state sent to Jev, including task metadata and omissions.
    if (stableJson(makeBody()).length <= maxEvidenceChars) break;
    const removed = selected.pop();
    if (!removed) break;
    omittedCount += 1;
    omissions.push({ id: removed.id, reason: "evidence-budget", chars: stableJson(removed).length });
  }
  if (omittedCount < ranked.length - selected.length) omittedCount = ranked.length - selected.length;
  let body = makeBody();
  // In the extreme case, even the compact omission preview can exceed a very small requested budget.
  while (stableJson(body).length > maxEvidenceChars && body.evidence.omissions.length) {
    omissions.pop();
    body = makeBody();
  }
  const canonical = stableJson(body);
  return { ...body, evidenceBundleHash: createHash("sha256").update(canonical).digest("hex") };
}

export function compactContextPreview(state) {
  return state;
}

export function validateReducedContext(state) {
  if (!state?.task || !state?.repository || !Array.isArray(state?.evidence?.candidates)) {
    throw new Error("Reduced evidence bundle is missing required fields.");
  }
  return state;
}

export { DEFAULT_EVIDENCE_CHARS };
