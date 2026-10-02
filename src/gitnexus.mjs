import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { packageRoot, repoRoot } from "./config.mjs";

function invocation(args) {
  const localCli = path.join(packageRoot, "node_modules", "gitnexus", "dist", "cli", "index.js");
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
  return parseJsonOutput(runGitNexus(["status", "--repo", repoName(), "--json"]), "status");
}

export function query(searchQuery, limit = 5) {
  return parseJsonOutput(runGitNexus([
    "query", "--repo", repoName(), "--query", searchQuery, "--limit", String(limit), "--content",
  ]), "query");
}

export function context(candidate) {
  const args = ["context", "--repo", repoName()];
  if (candidate.uid) args.push("--uid", candidate.uid);
  else {
    args.push("--name", candidate.name);
    if (candidate.filePath) args.push("--file", candidate.filePath);
  }
  args.push("--content");
  return parseJsonOutput(runGitNexus(args), "context");
}

export function sourceSnapshot() {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const statusBytes = execFileSync("git", ["status", "--porcelain=v2", "-z", "--untracked-files=all"], {
    cwd: repoRoot, encoding: "buffer",
  });
  const trackedDiff = execFileSync("git", ["diff", "--binary", "HEAD", "--"], { cwd: repoRoot, encoding: "buffer" });
  const untrackedPaths = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: repoRoot, encoding: "buffer",
  }).toString("utf8").split("\0").filter(Boolean).sort();
  const digest = createHash("sha256");
  digest.update("jevnexus-source-snapshot-v1\0");
  digest.update(statusBytes);
  digest.update("\0");
  digest.update(trackedDiff);
  for (const relativePath of untrackedPaths) {
    const filePath = path.resolve(repoRoot, relativePath);
    const stats = fs.lstatSync(filePath);
    digest.update("\0untracked\0");
    digest.update(relativePath);
    digest.update("\0");
    digest.update(stats.isSymbolicLink() ? fs.readlinkSync(filePath) : fs.readFileSync(filePath));
  }
  return {
    head,
    dirty: statusBytes.length > 0,
    dirtyDigest: digest.digest("hex"),
  };
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

export function createColdSource() {
  return { kind: "gitnexus-cli-json", warm: false, status, query, context, sourceSnapshot, trackedFiles };
}

export function repoName() {
  return process.env.GITNEXUS_REPO || path.basename(repoRoot);
}
