import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { repoDecide } from "./repo-decide.mjs";
import { createRepoDecideHandler, createRepoEvidenceHandler, registerRepoDecideTool, registerRepoEvidenceTool } from "./mcp-tool.mjs";
import { GitNexusMcpSource } from "./gitnexus-mcp.mjs";

const gitnexus = new GitNexusMcpSource();
const server = new McpServer(
  { name: "jevnexus", version: "0.1.0" },
  {
    instructions:
      "JevNexus gathers bounded structured GitNexus evidence. Use repo_evidence to preview without Jev, or repo_decide for one focused decision. GitNexus context stays internal unless debug is explicitly true.",
  },
);

registerRepoDecideTool(server, createRepoDecideHandler({ source: gitnexus, decideFn: repoDecide }));
registerRepoEvidenceTool(server, createRepoEvidenceHandler({ source: gitnexus }));

async function stop() {
  await gitnexus.stop();
  await server.close().catch(() => {});
}

process.on("SIGINT", () => { void stop(); });
process.on("SIGTERM", () => { void stop(); });

try {
  await gitnexus.start();
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: "JevNexus MCP startup failed.", code: error.code || "MCP_STARTUP_FAILURE" }));
  await gitnexus.stop();
  process.exitCode = 1;
}
