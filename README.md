# JevNexus

JevNexus is a small repository-decision layer for Codex:

```text
Codex → JevNexus MCP (stdio) → bounded GitNexus search → symbol context/edges → deterministic evidence selection → Jev
```

The MCP server is the Codex-facing boundary. It runs bounded searches, expands the strongest candidates through one caller/callee hop, and selects whole evidence blocks deterministically. `repo_evidence` previews that bundle without calling Jev. `repo_decide` sends the same bundle to Jev after confirming that the GitNexus index matches a clean source snapshot. Repository evidence stays private unless `debug: true` is requested.

The default collector uses at most three searches, six symbol-context lookups, one graph hop, and two concurrent requests. Search results are gathered in request order, then candidates are resolved by reciprocal rank and stable symbol ID. The default evidence budget is 24,000 characters (about 9,600 tokens using a conservative 2.5-characters-per-token estimate). The installed TypeSafe SDK does not expose an authoritative model context limit, so this estimate is a planning aid rather than a hard model limit; live Jev calls also report actual token usage.

## Setup

Requirements: Node.js 20+, Git, a Git repository, and a TypeSafe API key.

```powershell
npm install
$env:TYPESAFE_API_KEY = "..."
npm run index
```

`npm run index` creates or refreshes the local `.gitnexus/` graph index. The derived index is ignored by Git. Refresh it after source changes before asking Jev to decide; stale or dirty source snapshots can still be previewed but are refused for a decision.

## Start the warm service

```powershell
npm run warm:start
```

The project service listens on `127.0.0.1:4850` and starts the GitNexus MCP server as a structured local subprocess. To choose a different JevNexus service port, set `JEVNEXUS_PORT`.

```powershell
$env:JEVNEXUS_PORT = "4851"
npm run warm:start
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:4850/health
```

The service owns one GitNexus MCP process for its lifetime, so repeated decisions reuse the graph process.

The HTTP service remains available for external clients. It exposes `POST /evidence` for previews and `POST /repo_decide` for decisions.

## MCP server for Codex

Install the dependencies and index the repository once:

```powershell
npm install
$env:TYPESAFE_API_KEY = "..."
npm run index
```

Codex launches the local stdio server on demand. The tested local registration is in `~/.codex/config.toml`:

```toml
[mcp_servers.jevnexus]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\path\to\JevNexus\src\mcp-server.mjs']
cwd = 'C:\path\to\JevNexus'
env_vars = ["TYPESAFE_API_KEY"]
startup_timeout_sec = 60
tool_timeout_sec = 60
enabled = true
enabled_tools = ["repo_decide", "repo_evidence"]
```

`env_vars` forwards the existing key to the child process without putting the secret in the MCP response, source tree, or configuration file. Run `npm run mcp:start` directly when debugging the stdio server; normal Codex use starts one process and keeps it alive for repeated calls.

For another repository, configure a project-local MCP override and set
`JEVNEXUS_REPO_ROOT` to that checkout. The server code/dependencies remain in
the JevNexus installation; GitNexus status, queries, and tracked-file context
use the selected repository. Keep the original global `jevnexus` entry
unchanged so its project chat continues to target JevNexus.

```toml
[mcp_servers.jevnexus]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\path\to\JevNexus\src\mcp-server.mjs']
cwd = 'C:\path\to\YourProject'
env = { JEVNEXUS_REPO_ROOT = 'C:\path\to\YourProject' }
env_vars = ["TYPESAFE_API_KEY"]
startup_timeout_sec = 60
tool_timeout_sec = 60
enabled = true
enabled_tools = ["repo_decide", "repo_evidence"]
```

### Tool schema

The server exposes two tools:

```text
repo_decide({
  question: string,                         // required, non-empty
  choices?: string[] | Record<string, string | null>,
  decisionType?: "choice" | "noul" | "yes-no" | "yes_no" | "boolean" | "score",
  queryLimit?: integer,                      // optional, 1–10
  searchLimit?: integer,                      // optional, 1–3
  expansionLimit?: integer,                   // optional, 0–6
  graphDepth?: integer,                       // optional, 0–1
  maxEvidenceChars?: integer,                 // optional, 1,000–100,000
  recordDiagnostics?: boolean,                // optional; writes ignored local artifacts
  debug?: boolean                             // optional; includes selected evidence
})

repo_evidence({
  question: string,                           // required; previews evidence without Jev
  queryLimit?: integer,
  searchLimit?: integer,
  expansionLimit?: integer,
  graphDepth?: integer,
  maxEvidenceChars?: integer,
  recordDiagnostics?: boolean
})
```

`choice` accepts at least two labels or a label-to-description object. `noul` is the Jev yes/no-style decision and may take `{ "yes": "...", "no": "..." }`. `score` accepts an ordered array of 2–10 rubric levels. Invalid inputs are rejected by the MCP schema or returned as a structured `INVALID_REQUEST`/`INVALID_DECISION` error. GitNexus startup/index failures and Jev failures are returned as safe error codes without API-key material.

Default successful output is compact JSON in the MCP text result:

```json
{
  "ok": true,
  "decision": {
    "type": "choice",
    "choice": "gitnexus",
    "confidence": 0.7
  },
  "model": "jev-1.13.0",
  "metrics": {
    "source": "warm-eval-server",
    "gitnexusQueryMs": 254,
    "reducerMs": 0.02,
    "jevMs": 107,
    "totalMs": 362,
    "inputTokens": 953,
    "outputTokens": 69,
    "repositoryContextChars": 1594,
    "jevInputContextChars": 1639,
    "codexVisibleContextChars": 0,
    "contextKeptAwayFromCodexChars": 1594
  }
}
```

The `debug` option adds the selected evidence bundle to a decision response. `repo_evidence` always returns the preview and does not call Jev. Diagnostics are opt-in and written under ignored `artifacts/evidence/`; they contain source excerpts, questions, and results, but never API keys.

## Codex-facing interface

Call one endpoint with a small request:

```powershell
$body = @{
  question = "Which subsystem should be inspected next?"
  choices = @{
    gitnexus = "the graph adapter or reducer"
    jev = "the decision adapter"
    tests = "the tests"
  }
  decisionType = "choice"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:4850/repo_decide `
  -ContentType "application/json" -Body $body
```

Supported decision types:

- `choice`: `choices` is an array of labels or a label-to-description object.
- `noul` (also `yes-no`, `yes_no`, or `boolean`): `choices` is optional and may describe `yes` and `no`.
- `score`: `choices` is an ordered array of 2–10 rubric levels.

Example Noul request:

```json
{
  "question": "Is more repository context needed before acting?",
  "decisionType": "noul"
}
```

Example response shape:

```json
{
  "ok": true,
  "decision": { "type": "choice", "choice": "gitnexus", "confidence": 0.7 },
  "model": "jev-1.13.0",
  "metrics": {
    "source": "warm-eval-server",
    "gitnexusQueryMs": 186,
    "reducerMs": 0.02,
    "jevMs": 222,
    "totalMs": 407,
    "inputTokens": 560,
    "outputTokens": 44,
    "contextKeptAwayFromCodexChars": 590
  }
}
```

Use `repo_evidence` to inspect the evidence before spending a Jev call. Use `"debug": true` only when the decision response also needs to include that evidence bundle.

## Benchmark

Run the cold path once, then four decisions through one warm service session:

```powershell
npm run benchmark
```

Benchmark the actual MCP stdio process and repeated calls in one session:

```powershell
npm run benchmark:mcp
```

The benchmark reports:

- cold current path, including CLI/GitNexus startup;
- first request through the warm daemon;
- repeated warm requests in the same session;
- GitNexus query, reducer, Jev, and total timings;
- Jev input/output tokens;
- repository-context characters retained internally, passed to Jev, visible to Codex, and kept away from Codex.

The warm path is intended to remove the repeated GitNexus process/database initialization cost. Decision quality is intentionally out of scope for this slice.

Measured on 2026-09-22 with the local JevNexus repository and one `choice` decision:

| Path | Client end-to-end | GitNexus query | Reducer | Jev | Jev input tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cold current path | 37,096 ms | 1,806 ms | 0.38 ms | 278 ms | 1,213 |
| Warm first request | 1,044 ms | 788 ms | 0.23 ms | 194 ms | 953 |
| Warm repeated average (3) | 436 ms | ~271 ms | 0.02 ms | ~161 ms | 953 |

The MCP run on the same machine and repository produced:

| Path | Process startup | MCP call latency | GitNexus query | Reducer | Jev | Jev input tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| MCP first call after connect | 1,229 ms startup | 1,031 ms | 757 ms | 0.22 ms | 265 ms | 953 |
| MCP repeated average (3) | same process | 363 ms | ~254 ms | 0.02 ms | ~107 ms | 953 |

The warm HTTP repeated average was 436 ms in the current run; the MCP repeated average was 363 ms in its current run, about 73 ms faster on these samples. Comparing the MCP client wall clock with JevNexus’s internal `totalMs` showed approximately 2 ms of MCP framing/serialization overhead. The MCP startup cost is paid once per Codex-launched server process, not once per decision.

The cold run spent approximately 34,845 ms in GitNexus status/process initialization. The warm daemon removed that repeated initialization. The cold reducer saw approximately 33,621 context characters and reduced them to 1,792 characters for Jev; the default Codex response exposed none of that repository context. Warm queries in this small repository returned less raw text because the persistent eval-server formatter omits unnecessary source detail, while the reducer contract remained unchanged.

## Modules

- `src/gitnexus.mjs`: CLI fallback and clean source-snapshot hashing.
- `src/gitnexus-mcp.mjs`: structured GitNexus MCP adapter and process lifecycle.
- `src/evidence-collector.mjs`: bounded Propose → Gather → Resolve collection and one-hop symbol expansion.
- `src/context-reducer.mjs`: stable evidence ranking, whole-block budget selection, and canonical bundle hash.
- `src/jev.mjs`: Jev-only typed decision adapter.
- `src/repo-decide.mjs`: preview/decision composition, freshness gate, metrics, and opt-in local diagnostics.
- `src/server.mjs`: Codex-facing `/repo_decide` service.
- `src/benchmark.mjs`: cold/warm/repeated-session benchmark.
- `src/mcp-tool.mjs`: MCP schema, registration, compact response, and safe error adapter.
- `src/mcp-server.mjs`: local MCP stdio server; owns one structured GitNexus MCP client for its lifetime.
- `src/mcp-client.mjs`: stdio MCP client helper used by verification and benchmarks.
- `src/mcp-smoke.mjs`: live MCP → GitNexus → reducer → Jev verification for choice/noul/score.
- `src/mcp-benchmark.mjs`: repeated MCP-session benchmark compared with the warm HTTP reference.
