import { performance } from "node:perf_hooks";
import { defaultQuery } from "./config.mjs";
import { reduceContext, validateReducedContext } from "./context-reducer.mjs";
import { decide } from "./jev.mjs";
import { query, status, trackedFiles } from "./gitnexus.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function collectContext(question) {
  const started = performance.now();
  const indexStarted = performance.now();
  const indexStatus = status();
  const indexMs = performance.now() - indexStarted;
  const queryStarted = performance.now();
  const queryResult = query(question);
  const queryMs = performance.now() - queryStarted;
  const state = validateReducedContext(reduceContext({
    question,
    status: indexStatus,
    queryResult,
    files: trackedFiles(),
  }));
  return {
    state,
    collection: {
      totalMs: performance.now() - started,
      indexMs,
      queryMs,
      reducedStateChars: JSON.stringify(state).length,
    },
  };
}

async function main() {
  const command = process.argv[2] || "verify";
  const question = arg("--question", defaultQuery);
  const started = performance.now();

  if (command === "query") {
    const result = collectContext(question);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command !== "decide" && command !== "verify") {
    throw new Error(`Unknown command: ${command}`);
  }

  const collected = collectContext(question);
  const decisionStarted = performance.now();
  const response = await decide(collected.state);
  const decisionMs = performance.now() - decisionStarted;
  const output = {
    ok: true,
    architecture: "Codex -> repo_decide -> GitNexus/context reducer -> Jev -> structured decision",
    decision: response.answers,
    usage: response.usage ?? null,
    timingsMs: {
      ...collected.collection,
      jevMs: decisionMs,
      endToEndMs: performance.now() - started,
    },
    gitnexus: collected.state.gitnexus,
    stateSummary: {
      fileCount: collected.state.repository.fileCount,
      evidenceChars: JSON.stringify(collected.state.searchEvidence).length,
    },
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
