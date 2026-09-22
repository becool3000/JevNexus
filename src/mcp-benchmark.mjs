import { performance } from "node:perf_hooks";
import { connectMcpClient, parseToolText } from "./mcp-client.mjs";

const question = "Which bounded action should Codex take next for the repository decision harness?";
const choices = {
  inspect_gitnexus_adapter: "Inspect the GitNexus adapter or reducer.",
  inspect_jev_adapter: "Inspect the Jev adapter.",
  run_tests: "Run tests.",
  ask_codex_for_deeper_reasoning: "Ask Codex for deeper reasoning.",
};

function summary(samples) {
  const values = samples.map((sample) => sample.clientTotalMs);
  return {
    count: values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

const startupStarted = performance.now();
const { client, transport } = await connectMcpClient({ env: { GITNEXUS_EVAL_PORT: "4852" } });
const startupMs = performance.now() - startupStarted;
try {
  const listed = await client.listTools();
  const samples = [];
  for (let index = 0; index < 4; index += 1) {
    const callStarted = performance.now();
    const result = parseToolText(await client.callTool({
      name: "repo_decide",
      arguments: { question, choices, decisionType: "choice" },
    }));
    samples.push({ clientTotalMs: performance.now() - callStarted, metrics: result.metrics });
  }
  console.log(JSON.stringify({
    question,
    toolCount: listed.tools.length,
    startupMs,
    mcpFirst: samples[0],
    mcpRepeated: { summary: summary(samples.slice(1)), samples: samples.slice(1) },
    warmHttpReference: { repeatedAverageMs: 455, source: "existing benchmark result" },
  }, null, 2));
} finally {
  await client.close().catch(() => {});
  await transport.close().catch(() => {});
}
