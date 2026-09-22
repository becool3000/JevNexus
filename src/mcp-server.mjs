import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { repoDecide } from "./repo-decide.mjs";
import { createRepoDecideHandler, registerRepoDecideTool } from "./mcp-tool.mjs";
import { WarmGitNexusClient } from "./gitnexus-warm.mjs";

const gitnexus = new WarmGitNexusClient();
const server = new McpServer(
  { name: "jevnexus", version: "0.1.0" },
  {
    instructions:
      "JevNexus makes small repository decisions. Call repo_decide with a focused question; GitNexus context stays internal unless debug is explicitly true.",
  },
);

registerRepoDecideTool(server, createRepoDecideHandler({ source: gitnexus, decideFn: repoDecide }));

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
