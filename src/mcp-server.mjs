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
      "Use repo_decide to ask Jev for one focused, typed recommendation about the configured repository. JevNexus sends the question, choices, and selected repository context to TypeSafe. This requires a valid TYPESAFE_API_KEY, a current GitNexus index, and a clean checkout. Use repo_evidence only to troubleshoot retrieval; debug controls whether selected context is included in the tool response, not whether it is sent to Jev.",
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
