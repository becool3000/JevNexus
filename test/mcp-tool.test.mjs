import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRepoDecideHandler, registerRepoDecideTool } from "../src/mcp-tool.mjs";
import { parseToolText } from "../src/mcp-client.mjs";

test("MCP repo_decide returns a compact typed result and hides context by default", async () => {
  const server = new McpServer({ name: "test-jevnexus", version: "0.1.0" });
  const handler = createRepoDecideHandler({
    source: { kind: "fake", warm: true },
    decideFn: async (question, choices, decisionType, options) => ({
      ok: true,
      decision: "run_tests",
      metrics: { totalMs: 3, gitnexusQueryMs: 1, jevMs: 1, inputTokens: 2, outputTokens: 1, codexVisibleContextChars: 0 },
      received: { question, choices, decisionType, options },
    }),
  });
  registerRepoDecideTool(server, handler);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const tools = await client.listTools();
    assert.equal(tools.tools[0].name, "repo_decide");
    const result = parseToolText(await client.callTool({
      name: "repo_decide",
      arguments: { question: "What should happen next?", choices: ["run_tests", "no_action"] },
    }));
    assert.equal(result.ok, true);
    assert.equal(result.decision, "run_tests");
    assert.equal(result.metrics.codexVisibleContextChars, 0);
    assert.equal(Object.hasOwn(result, "context"), false);
  } finally {
    await client.close();
    await server.close();
  }
});

test("MCP repo_decide returns safe structured errors", async () => {
  const result = await createRepoDecideHandler({
    source: { kind: "fake", warm: true },
    decideFn: async () => { throw new Error("Unsupported decisionType 'bad'. Use choice, noul, or score."); },
  })({ question: "invalid" });
  assert.equal(result.isError, true);
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "INVALID_DECISION");
  assert.match(payload.error.message, /Unsupported decisionType/);
});

test("MCP repo_decide classifies index and request failures without leaking details", async () => {
  const missingQuestion = await createRepoDecideHandler({ decideFn: async () => { throw new Error("should not run"); } })({});
  assert.equal(JSON.parse(missingQuestion.content[0].text).error.code, "INVALID_REQUEST");

  const stale = await createRepoDecideHandler({ decideFn: async () => {
    const error = new Error("index path D:\\secret\\repo is stale");
    error.code = "GITNEXUS_INDEX_STALE";
    throw error;
  } })({ question: "test" });
  const stalePayload = JSON.parse(stale.content[0].text);
  assert.equal(stalePayload.error.code, "GITNEXUS_INDEX_STALE");
  assert.doesNotMatch(stalePayload.error.message, /secret/);
});
