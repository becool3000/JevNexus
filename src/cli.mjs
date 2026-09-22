import { defaultQuery } from "./config.mjs";
import { collectContext, repoDecide } from "./repo-decide.mjs";

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

  if (command === "query") {
    const result = await collectContext(question);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command !== "decide" && command !== "verify") {
    throw new Error(`Unknown command: ${command}`);
  }

  console.log(JSON.stringify(await repoDecide(question, choices, decisionType, { includeContext: debug }), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
