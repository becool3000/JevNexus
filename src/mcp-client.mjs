import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { packageRoot, repoRoot } from "./config.mjs";

export async function connectMcpClient({ stderr = "pipe", env = {} } = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(packageRoot, "src", "mcp-server.mjs")],
    cwd: repoRoot,
    env: Object.fromEntries(Object.entries({ ...process.env, ...env }).filter(([, value]) => value !== undefined)),
    stderr,
  });
  const client = new Client({ name: "jevnexus-verifier", version: "0.1.0" });
  await client.connect(transport);
  return { client, transport };
}

export function parseToolText(result) {
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("MCP tool returned no text content.");
  return JSON.parse(text);
}
