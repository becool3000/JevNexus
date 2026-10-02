import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { packageRoot, repoRoot } from "./config.mjs";
import { context as cliContext, query as cliQuery, sourceSnapshot, status, trackedFiles } from "./gitnexus.mjs";

const QUERY_RESPONSE_BUDGET = 8000;
const CONTEXT_RESPONSE_BUDGET = 5000;

export function parseGitNexusToolResult(result) {
  if (result?.isError) throw Object.assign(new Error("GitNexus returned an error."), { code: "GITNEXUS_QUERY_FAILED" });
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw Object.assign(new Error("GitNexus returned no structured content."), { code: "GITNEXUS_RESPONSE_INVALID" });
  }
  const start = text.search(/[\[{]/);
  if (start < 0) throw Object.assign(new Error("GitNexus response did not contain JSON."), { code: "GITNEXUS_RESPONSE_INVALID" });
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) { end = index + 1; break; }
      if (depth < 0) break;
    }
  }
  if (end < 0) throw Object.assign(new Error("GitNexus returned incomplete JSON."), { code: "GITNEXUS_RESPONSE_TRUNCATED" });
  const suffix = text.slice(end).trim();
  const transportTruncated = suffix === "…" || suffix.startsWith("…\n");
  const nextHint = suffix.startsWith("---\n**Next:**") || suffix.startsWith("---\nNext:");
  if (suffix && !transportTruncated && !nextHint) {
    throw Object.assign(new Error("GitNexus response contained unexpected text after its JSON result."), { code: "GITNEXUS_RESPONSE_INVALID" });
  }
  const parsed = JSON.parse(text.slice(start, end));
  if (parsed?.error) throw Object.assign(new Error("GitNexus could not answer the repository query."), { code: "GITNEXUS_QUERY_FAILED" });
  if (transportTruncated) parsed._transportTruncated = true;
  return parsed;
}

export class GitNexusMcpSource {
  constructor({ repository = process.env.GITNEXUS_REPO || path.basename(repoRoot) } = {}) {
    this.kind = "gitnexus-mcp-structured";
    this.warm = true;
    this.repository = repository;
    this.client = null;
    this.transport = null;
    this.startPromise = null;
    this.tools = new Set();
  }

  async start() {
    if (this.client) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      const cli = path.join(packageRoot, "node_modules", "gitnexus", "dist", "cli", "index.js");
      this.transport = new StdioClientTransport({
        command: process.execPath,
        args: [cli, "mcp"],
        cwd: repoRoot,
        env: process.env,
        stderr: "pipe",
      });
      this.client = new Client({ name: "jevnexus-gitnexus-adapter", version: "0.2.0" });
      try {
        await this.client.connect(this.transport);
        const listing = await this.client.listTools();
        this.tools = new Set((listing.tools ?? []).map((tool) => tool.name));
        if (!this.tools.has("list_repos") || !this.tools.has("query") || !this.tools.has("context")) {
          throw Object.assign(new Error("GitNexus MCP does not expose list_repos, query, and context."), { code: "GITNEXUS_TOOL_MISSING" });
        }
      } catch (error) {
        await this.close();
        throw error;
      }
    })();
    try { await this.startPromise; }
    finally { this.startPromise = null; }
  }

  async status() {
    await this.start();
    let offset = 0;
    let repository = null;
    while (!repository) {
      const result = await this.client.callTool({ name: "list_repos", arguments: { limit: 200, offset } });
      const page = parseGitNexusToolResult(result);
      repository = (page.repositories ?? []).find((candidate) => candidate.name === this.repository ||
        path.resolve(candidate.path ?? "") === path.resolve(repoRoot));
      if (!repository || !page.pagination?.hasMore) break;
      offset = page.pagination.nextOffset;
    }
    if (!repository) {
      throw Object.assign(new Error(`GitNexus has no indexed repository named '${this.repository}'.`), { code: "GITNEXUS_INDEX_UNAVAILABLE" });
    }
    return {
      status: repository.staleness?.status === "behind" ? "stale" : "up-to-date",
      indexed: true,
      repository: repository.name,
      repo: repository.name,
      index: { commit: repository.lastCommit, indexedAt: repository.indexedAt },
      stats: repository.stats,
      staleness: repository.staleness ?? null,
    };
  }

  async health() {
    const current = await this.status();
    return { repos: [this.repository], status: current?.status ?? "ready" };
  }

  async sourceSnapshot() {
    return sourceSnapshot();
  }

  async trackedFiles() {
    return trackedFiles();
  }

  async query(searchQuery, limit = 5, { taskContext, goal } = {}) {
    await this.start();
    const result = await this.client.callTool({
      name: "query",
      arguments: {
        repo: this.repository,
        search_query: searchQuery,
        ...(taskContext ? { task_context: taskContext } : {}),
        ...(goal ? { goal } : {}),
        limit,
        max_symbols: 20,
        include_content: false,
        maxTokens: QUERY_RESPONSE_BUDGET,
      },
    });
    return parseGitNexusToolResult(result);
  }

  async context(candidate) {
    await this.start();
    const result = await this.client.callTool({
      name: "context",
      arguments: {
        repo: this.repository,
        ...(candidate.uid ? { uid: candidate.uid } : { name: candidate.name, file_path: candidate.filePath }),
        include_content: true,
        maxTokens: CONTEXT_RESPONSE_BUDGET,
      },
    });
    return parseGitNexusToolResult(result);
  }

  async close() {
    const client = this.client;
    const transport = this.transport;
    this.client = null;
    this.transport = null;
    this.tools.clear();
    if (client) await client.close().catch(() => {});
    if (transport) await transport.close().catch(() => {});
  }

  async stop() {
    await this.close();
  }
}

export function createColdStructuredSource() {
  return {
    kind: "gitnexus-cli-json",
    warm: false,
    status,
    query: (searchQuery, limit = 5) => cliQuery(searchQuery, limit),
    context: cliContext,
    sourceSnapshot,
    trackedFiles,
  };
}
