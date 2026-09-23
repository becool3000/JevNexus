import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Keep the JevNexus installation (code and dependencies) separate from the
// repository whose evidence is being reviewed. This allows a project-local
// MCP registration to reuse the installed server without indexing JevNexus
// by accident.
export const packageRoot = path.resolve(here, "..");
export function resolveRepoRoot(repoPath = process.env.JEVNEXUS_REPO_ROOT) {
  return repoPath ? path.resolve(repoPath) : packageRoot;
}
export const repoRoot = resolveRepoRoot();
export const jevModel = process.env.TYPESAFE_DEFAULT_MODEL || "jev-1.13.0";
export const defaultQuery = "repo decision harness GitNexus Jev";

export function requireApiKey() {
  if (!process.env.TYPESAFE_API_KEY) {
    throw new Error("TYPESAFE_API_KEY is not set; Jev live verification cannot run.");
  }
}
