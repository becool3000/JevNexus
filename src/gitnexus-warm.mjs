import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { packageRoot, repoRoot } from "./config.mjs";
import { trackedFiles } from "./gitnexus.mjs";

const DEFAULT_PORT = 4848;

export class WarmGitNexusClient {
  constructor({
    url = process.env.GITNEXUS_EVAL_SERVER_URL || `http://127.0.0.1:${process.env.GITNEXUS_EVAL_PORT || DEFAULT_PORT}`,
    repo = process.env.GITNEXUS_REPO || path.basename(repoRoot),
    autoStart = true,
  } = {}) {
    this.url = url.replace(/\/$/, "");
    this.repo = repo;
    this.autoStart = autoStart;
    this.child = null;
    this.files = null;
    this.kind = "warm-eval-server";
    this.warm = true;
  }

  async health() {
    const response = await fetch(`${this.url}/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error(`GitNexus warm health check failed with HTTP ${response.status}.`);
    return response.json();
  }

  async start() {
    try {
      const health = await this.health();
      this.assertIndexed(health);
      this.files = trackedFiles();
      return;
    } catch (error) {
      if (error.code === "GITNEXUS_INDEX_UNAVAILABLE") throw error;
      if (!this.autoStart) throw error;
    }

    const port = new URL(this.url).port || String(DEFAULT_PORT);
    const localCli = path.join(packageRoot, "node_modules", "gitnexus", "dist", "cli", "index.js");
    if (!fs.existsSync(localCli)) throw new Error(`Local GitNexus CLI not found at ${localCli}.`);
    this.child = spawn(process.execPath, [localCli, "eval-server", "--host", "127.0.0.1", "--port", port], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    });
    this.child.on("exit", () => { this.child = null; });

    let lastError;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      try {
        const health = await this.health();
        this.assertIndexed(health);
        this.files = trackedFiles();
        return;
      } catch (error) {
        if (error.code === "GITNEXUS_INDEX_UNAVAILABLE") throw error;
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error(`GitNexus warm service did not become ready at ${this.url}.`, { cause: lastError });
  }

  assertIndexed(health) {
    if (!Array.isArray(health?.repos) || !health.repos.includes(this.repo)) {
      const error = new Error(`GitNexus has no warm index for repository '${this.repo}'. Run npm run index first.`);
      error.code = "GITNEXUS_INDEX_UNAVAILABLE";
      throw error;
    }
  }

  async status() {
    return {
      status: "warm",
      indexed: true,
      repository: this.repo,
      warm: true,
    };
  }

  async query(text, limit = 5) {
    const response = await fetch(`${this.url}/tool/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo: this.repo,
        search_query: text,
        limit,
        include_content: true,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`GitNexus warm query failed with HTTP ${response.status}.`);
      if (/not indexed|run .*gitnexus analyze|no indexed repositories/i.test(body)) error.code = "GITNEXUS_INDEX_STALE";
      throw error;
    }
    if (/not indexed|run .*gitnexus analyze|no indexed repositories/i.test(body)) {
      const error = new Error("GitNexus returned an uninitialized or stale index response.");
      error.code = "GITNEXUS_INDEX_STALE";
      throw error;
    }
    return body;
  }

  async trackedFiles() {
    if (!this.files) this.files = trackedFiles();
    return this.files;
  }

  async stop() {
    if (!this.child) return;
    this.child.kill();
    this.child = null;
  }
}
