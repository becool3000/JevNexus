const MAX_QUERY_CHARS = 5000;
const MAX_FILES = 40;

function compactStatus(status) {
  const data = status?.data ?? status;
  return {
    indexed: Boolean(data?.indexed ?? data?.exists ?? (data?.status === "ready" || data?.status === "up-to-date")),
    repo: data?.repo ?? data?.name ?? data?.repository ?? null,
    symbols: data?.symbols ?? data?.symbolCount ?? null,
    relationships: data?.relationships ?? data?.relationshipCount ?? null,
    updatedAt: data?.updatedAt ?? data?.lastUpdated ?? data?.index?.indexedAt ?? null,
  };
}

function compactQuery(queryResult) {
  if (typeof queryResult === "string") return queryResult.slice(0, MAX_QUERY_CHARS);
  return {
    processes: (queryResult?.processes ?? []).map(({ id, summary, priority, symbol_count, step_count }) => ({
      id, summary, priority, symbol_count, step_count,
    })),
    symbols: (queryResult?.process_symbols ?? []).slice(0, 8).map(({ id, name, filePath, startLine, endLine, module }) => ({
      id, name, filePath, startLine, endLine, module,
    })),
  };
}

export function reduceContext({ question, status, queryResult, files }) {
  return {
    task: question,
    repository: {
      files: files.slice(0, MAX_FILES),
      fileCount: files.length,
    },
    gitnexus: compactStatus(status),
    searchEvidence: compactQuery(queryResult),
  };
}

export function validateReducedContext(state) {
  if (!state?.task || !state?.gitnexus || !Array.isArray(state?.repository?.files)) {
    throw new Error("Reduced context is missing required fields.");
  }
  return state;
}
