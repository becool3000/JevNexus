import { defaultQuery } from "./config.mjs";
import { collectContext, repoDecide } from "./repo-decide.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

async function main() {
  const command = process.argv[2] || "verify";
  const question = arg("--question", defaultQuery);

  if (command === "query") {
    const result = collectContext(question);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command !== "decide" && command !== "verify") {
    throw new Error(`Unknown command: ${command}`);
  }

  console.log(JSON.stringify(await repoDecide(question), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
