import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { packageRoot, repoRoot } from "./config.mjs";

const question = "Which bounded action should Codex take next for the repository decision harness?";
const choices = {
  inspect_gitnexus_adapter: "Inspect the GitNexus adapter or reducer.",
  inspect_jev_adapter: "Inspect the Jev adapter.",
  run_tests: "Run tests.",
  ask_codex_for_deeper_reasoning: "Ask Codex for deeper reasoning.",
};

function coldDecision() {
  const started = performance.now();
  const result = spawnSync(process.execPath, [
    path.join(packageRoot, "src", "cli.mjs"),
    "decide",
    "--question", question,
    "--decision-type", "choice",
    "--choices-json", JSON.stringify(choices),
  ], { cwd: repoRoot, encoding: "utf8", env: process.env, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Cold decision failed.");
  return { clientTotalMs: performance.now() - started, ...JSON.parse(result.stdout) };
}

async function waitForReady(child) {
  let output = "";
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Warm server did not start. ${output}`)), 45000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes("JEVNEXUS_WARM_SERVER_READY:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Warm server exited with code ${code}. ${output}`));
      }
    });
  });
}

async function warmDecision() {
  const started = performance.now();
  const response = await fetch("http://127.0.0.1:4850/repo_decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, choices, decisionType: "choice" }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(JSON.stringify(result));
  return { clientTotalMs: performance.now() - started, ...result };
}

function summary(samples) {
  const values = samples.map((sample) => sample.clientTotalMs);
  return {
    count: values.length,
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
    averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

async function main() {
  const cold = coldDecision();
  const warmServer = spawn(process.execPath, [path.join(packageRoot, "src", "server.mjs")], {
    cwd: repoRoot,
    env: { ...process.env, JEVNEXUS_PORT: "4850", GITNEXUS_EVAL_PORT: "4851" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  try {
    await waitForReady(warmServer);
    const warm = [];
    for (let index = 0; index < 4; index += 1) warm.push(await warmDecision());
    console.log(JSON.stringify({
      question,
      cold: {
        clientTotalMs: cold.clientTotalMs,
        metrics: cold.metrics,
      },
      warmFirst: {
        clientTotalMs: warm[0].clientTotalMs,
        metrics: warm[0].metrics,
      },
      warmRepeated: {
        summary: summary(warm.slice(1)),
        samples: warm.slice(1).map(({ clientTotalMs, metrics }) => ({ clientTotalMs, metrics })),
      },
    }, null, 2));
  } finally {
    try { await fetch("http://127.0.0.1:4850/shutdown", { method: "POST" }); } catch {}
    await new Promise((resolve) => warmServer.once("exit", resolve));
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
