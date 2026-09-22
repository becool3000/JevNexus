import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./config.mjs";

function invocation(args) {
  const localCli = path.join(repoRoot, "node_modules", "gitnexus", "dist", "cli", "index.js");
  if (fs.existsSync(localCli)) return { file: process.execPath, args: [localCli, ...args], shell: false };
  return { file: "gitnexus", args, shell: process.platform === "win32" };
}

export function runGitNexus(args) {
  const command = invocation(args);
  try {
    return execFileSync(command.file, command.args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
      shell: command.shell,
    }).trim();
  } catch (error) {
    const details = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`GitNexus ${args.join(" ")} failed${details ? `: ${details}` : ""}`, { cause: error });
  }
}

export function status() {
  return parseJsonOutput(runGitNexus(["status", "--json"]), "status");
}

export function query(text, limit = 5) {
  return parseJsonOutput(runGitNexus(["query", "--query", text, "--limit", String(limit), "--content"]), "query");
}

function parseJsonOutput(output, command) {
  const jsonStart = output.indexOf("{");
  if (jsonStart === -1) throw new Error(`GitNexus ${command} did not return JSON.`);
  return JSON.parse(output.slice(jsonStart));
}

export function trackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}
