import { repoDecide, repoEvidence } from "./repo-decide.mjs";
import { z } from "zod";

export const MCP_TOOL_NAME = "repo_decide";
export const MCP_EVIDENCE_TOOL_NAME = "repo_evidence";

export const repoDecideInputSchema = {
  question: z.string().min(1),
  choices: z.union([
    z.array(z.string()).min(2).max(10),
    z.record(z.string(), z.string().nullable()),
  ]).optional(),
  decisionType: z.enum(["choice", "noul", "yes-no", "yes_no", "boolean", "score"]).optional(),
  queryLimit: z.number().int().min(1).max(10).optional(),
  searchLimit: z.number().int().min(1).max(3).optional(),
  expansionLimit: z.number().int().min(0).max(6).optional(),
  graphDepth: z.number().int().min(0).max(1).optional(),
  maxEvidenceChars: z.number().int().min(1000).max(100000).optional(),
  recordDiagnostics: z.boolean().optional(),
  debug: z.boolean().optional(),
};

export const repoEvidenceInputSchema = {
  question: z.string().min(1),
  queryLimit: z.number().int().min(1).max(10).optional(),
  searchLimit: z.number().int().min(1).max(3).optional(),
  expansionLimit: z.number().int().min(0).max(6).optional(),
  graphDepth: z.number().int().min(0).max(1).optional(),
  maxEvidenceChars: z.number().int().min(1000).max(100000).optional(),
  recordDiagnostics: z.boolean().optional(),
};

function safeError(error) {
  const message = String(error?.message || "Unknown JevNexus error.");
  if (error?.code === "INVALID_REQUEST") return { code: error.code, message };
  if (error?.code === "GITNEXUS_INDEX_UNAVAILABLE") {
    return { code: error.code, message };
  }
  if (error?.code === "GITNEXUS_INDEX_STALE") {
    return { code: error.code, message: "GitNexus needs to be indexed or refreshed before JevNexus can decide." };
  }
  if (error?.code === "GITNEXUS_REPOSITORY_DIRTY") {
    return { code: error.code, message: "JevNexus requires a clean repository checkout. Review and preserve your changes, then decide how to clean the checkout before retrying." };
  }
  if (error?.code === "GITNEXUS_SOURCE_CHANGED") {
    return { code: error.code, message: "The repository changed during evidence collection. Review the working tree and retry after it is stable." };
  }
  if (message.includes("GitNexus") || message.includes("warm service") || message.includes("warm query")) {
    return { code: "GITNEXUS_UNAVAILABLE", message: "GitNexus could not answer the repository query." };
  }
  if (message.includes("Unsupported decisionType") || message.includes("choice decisions") || message.includes("score decisions") || message.includes("noul choices")) {
    return { code: "INVALID_DECISION", message };
  }
  if (message.includes("TYPESAFE_API_KEY")) {
    return { code: "JEV_API_FAILURE", message: "TYPESAFE_API_KEY is unavailable to JevNexus. Configure it securely for the environment that launches this server, then reload MCP." };
  }
  if (error?.name === "TypeSafeError" || error?.statusCode >= 400) {
    return { code: "JEV_API_FAILURE", message: "Jev could not complete the decision." };
  }
  return { code: "JEVNEXUS_FAILURE", message: "JevNexus could not complete the decision." };
}

export function jsonToolResult(value, isError = false) {
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

export function createRepoDecideHandler({ source, decideFn = repoDecide } = {}) {
  return async function handleRepoDecide(args = {}) {
    try {
      if (typeof args.question !== "string" || !args.question.trim()) {
        const error = new Error("question must be a non-empty string.");
        error.code = "INVALID_REQUEST";
        throw error;
      }
      const result = await decideFn(args.question, args.choices, args.decisionType, {
        source,
        queryLimit: args.queryLimit,
        searchLimit: args.searchLimit,
        expansionLimit: args.expansionLimit,
        graphDepth: args.graphDepth,
        maxEvidenceChars: args.maxEvidenceChars,
        includeContext: args.debug === true,
        recordDiagnostics: args.recordDiagnostics === true,
      });
      return jsonToolResult(result);
    } catch (error) {
      return jsonToolResult({ ok: false, error: safeError(error) }, true);
    }
  };
}

export function createRepoEvidenceHandler({ source, evidenceFn = repoEvidence } = {}) {
  return async function handleRepoEvidence(args = {}) {
    try {
      if (typeof args.question !== "string" || !args.question.trim()) {
        const error = new Error("question must be a non-empty string.");
        error.code = "INVALID_REQUEST";
        throw error;
      }
      return jsonToolResult(await evidenceFn(args.question, {
        source,
        queryLimit: args.queryLimit,
        searchLimit: args.searchLimit,
        expansionLimit: args.expansionLimit,
        graphDepth: args.graphDepth,
        maxEvidenceChars: args.maxEvidenceChars,
        recordDiagnostics: args.recordDiagnostics === true,
      }));
    } catch (error) {
      return jsonToolResult({ ok: false, error: safeError(error) }, true);
    }
  };
}

export function registerRepoDecideTool(server, handler) {
  server.registerTool(
    MCP_TOOL_NAME,
    {
      title: "JevNexus repository decision",
      description:
        "Ask Jev for a typed recommendation using relevant code from the configured repository. Requires TypeSafe API access. Sends the question, choices, and selected repository context to TypeSafe; returns Jev's decision, model, and usage metrics.",
      inputSchema: repoDecideInputSchema,
    },
    handler,
  );
}

export function registerRepoEvidenceTool(server, handler) {
  server.registerTool(
    MCP_EVIDENCE_TOOL_NAME,
    {
      title: "JevNexus retrieval diagnostic",
      description: "Troubleshoot GitNexus retrieval by returning the selected source context without calling Jev. Context is returned to this agent. Diagnostics are written locally only when explicitly enabled.",
      inputSchema: repoEvidenceInputSchema,
    },
    handler,
  );
}

export { safeError };
