import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { connectMcpClient, parseToolText } from "./mcp-client.mjs";

const question = "Which bounded action should Codex take next for the repository decision harness?";
const choices = {
  inspect_gitnexus_adapter: "Inspect the GitNexus adapter or reducer.",
  inspect_jev_adapter: "Inspect the Jev adapter.",
  run_tests: "Run tests.",
  ask_codex_for_deeper_reasoning: "Ask Codex for deeper reasoning.",
};

const started = performance.now();
const { client, transport } = await connectMcpClient();
try {
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name), ["repo_decide"]);
  const results = {};
  for (const [decisionType, decisionChoices] of [
    ["choice", choices],
    ["noul", { yes: "Proceed with the bounded action.", no: "Do not proceed yet." }],
    ["score", ["low", "medium", "high"]],
  ]) {
    const callStarted = performance.now();
    const result = parseToolText(await client.callTool({
      name: "repo_decide",
      arguments: { question, choices: decisionChoices, decisionType },
    }));
    assert.equal(result.ok, true);
    assert.ok(result.decision !== null && result.decision !== undefined);
    assert.equal(Object.hasOwn(result, "context"), false);
    results[decisionType] = { callMs: performance.now() - callStarted, decision: result.decision, metrics: result.metrics };
  }
  console.log(JSON.stringify({ ok: true, startupMs: performance.now() - started, results }, null, 2));
} finally {
  await client.close().catch(() => {});
  await transport.close().catch(() => {});
}
