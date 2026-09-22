# JevNexus

JevNexus is a small repository-decision layer for Codex:

```text
Codex → repo_decide() → warm GitNexus → bounded context reducer → Jev → typed result → Codex
```

Codex supplies a narrow question and optional decision parameters. GitNexus and the reducer gather and compress repository evidence internally. The default result contains only the typed Jev decision, model, and timing/usage metrics; repository context is returned only with `debug: true`.

## Setup

Requirements: Node.js 20+, Git, a Git repository, and a TypeSafe API key.

```powershell
npm install
$env:TYPESAFE_API_KEY = "..."
npm run index
```

`npm run index` creates or refreshes the local `.gitnexus/` graph index. The derived index is ignored by Git. `GITNEXUS_CONTENT_RETENTION` can be used to control GitNexus source retention; this harness still sends only reducer output to Jev.

## Start the warm service

```powershell
npm run warm:start
```

The project service listens on `127.0.0.1:4850` and automatically starts GitNexus’s warm `eval-server` on port `4848`. To use an already-running GitNexus service instead:

```powershell
$env:GITNEXUS_EVAL_SERVER_URL = "http://127.0.0.1:4848"
npm run warm:start
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:4850/health
```

The service owns one warm GitNexus process for its lifetime, so repeated decisions do not reinitialize the graph database.

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

Add `"debug": true` only when inspecting the reducer boundary; that adds a compact context preview to the response.

## Benchmark

Run the cold path once, then four decisions through one warm service session:

```powershell
npm run benchmark
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
| Cold current path | 27,334 ms | 1,682 ms | 0.4 ms | 400 ms | 1,213 |
| Warm first request | 1,483 ms | 1,201 ms | 0.2 ms | 211 ms | 953 |
| Warm repeated average (3) | 455 ms | ~323 ms | 0.02 ms | ~126 ms | 953 |

The cold run spent approximately 25,078 ms in GitNexus status/process initialization. The warm daemon removed that repeated initialization. The cold reducer saw approximately 32,704 context characters and reduced them to 1,791 characters for Jev; the default Codex response exposed none of that repository context. Warm queries in this small repository returned less raw text because the persistent eval-server formatter omits unnecessary source detail, while the reducer contract remained unchanged.

## Modules

- `src/gitnexus.mjs`: cold CLI adapter.
- `src/gitnexus-warm.mjs`: persistent `eval-server` client and lifecycle wrapper.
- `src/context-reducer.mjs`: bounded, deterministic evidence reducer.
- `src/jev.mjs`: Jev-only typed decision adapter.
- `src/repo-decide.mjs`: reusable composition and instrumentation boundary.
- `src/server.mjs`: Codex-facing `/repo_decide` service.
- `src/benchmark.mjs`: cold/warm/repeated-session benchmark.
