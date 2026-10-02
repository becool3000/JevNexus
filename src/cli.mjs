import { defaultQuery } from "./config.mjs";
import { repoDecide, repoEvidence } from "./repo-decide.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function jsonArg(name) {
  const value = arg(name, undefined);
  return value === undefined ? undefined : JSON.parse(value);
}

async function main() {
  const command = process.argv[2] || "verify";
  const question = arg("--question", defaultQuery);
  const decisionType = arg("--decision-type", command === "verify" ? "choice" : undefined);
  const choices = jsonArg("--choices-json");
  const debug = process.argv.includes("--debug");
  const recordDiagnostics = process.argv.includes("--record-diagnostics");
  const queryLimit = Number(arg("--query-limit", 5));
  const searchLimit = Number(arg("--search-limit", 3));
  const expansionLimit = Number(arg("--expansion-limit", 6));
  const graphDepth = Number(arg("--graph-depth", 1));
  const maxEvidenceChars = Number(arg("--max-evidence-chars", 24000));

  if (command === "query" || command === "evidence" || command === "preview") {
    const result = await repoEvidence(question, {
      queryLimit, searchLimit, expansionLimit, graphDepth, maxEvidenceChars, recordDiagnostics,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command !== "decide" && command !== "verify") {
    throw new Error(`Unknown command: ${command}`);
  }

  console.log(JSON.stringify(await repoDecide(question, choices, decisionType, {
    queryLimit, searchLimit, expansionLimit, graphDepth, maxEvidenceChars,
    includeContext: debug, recordDiagnostics,
  }), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
