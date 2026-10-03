# MCP, HTTP, and benchmark reference

## MCP tools

The stdio server exposes two tools. `repo_evidence` previews a bounded source bundle without calling Jev. `repo_decide` submits that bundle with one focused question and optional choices.

```text
repo_evidence({
  question: string,
  queryLimit?: integer,
  searchLimit?: integer,       // 1–3; defaults to 3
  expansionLimit?: integer,    // 0–6; defaults to 6
  graphDepth?: integer,        // 0–1; defaults to 1
  maxEvidenceChars?: integer,  // 1,000–100,000
  recordDiagnostics?: boolean
})

repo_decide({
  question: string,
  choices?: string[] | Record<string, string | null>,
  decisionType?: "choice" | "noul" | "yes-no" | "yes_no" | "boolean" | "score",
  queryLimit?: integer,        // 1–10
  searchLimit?: integer,       // 1–3
  expansionLimit?: integer,    // 0–6
  graphDepth?: integer,        // 0–1
  maxEvidenceChars?: integer,  // 1,000–100,000
  recordDiagnostics?: boolean,
  debug?: boolean
})
```

`choice` needs at least two choices. `noul` is a yes/no decision and may use `{ "yes": "...", "no": "..." }`. `score` uses an ordered array of 2–10 rubric levels. `debug: true` includes selected evidence in the decision response; by default that evidence is not echoed to the caller.

Successful MCP tool results contain compact JSON text. A preview includes `ok`, the evidence bundle hash, collection metrics, and the selected context. A decision includes `ok`, a typed decision, model, and timing/token metrics. Invalid arguments and dependency failures return structured errors without including API key material.

## Local HTTP service

Start the optional warm local service with `npm run warm:start`. It listens on `127.0.0.1:4850` by default. Set `JEVNEXUS_PORT` to change the port. The service provides `POST /evidence` and `POST /repo_decide`; requests use the same question, choice, and decision-type fields as the MCP tools. Check `/health` for service state.

Example PowerShell decision request:

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

## Diagnostics

Set `recordDiagnostics: true` to write a local capture under ignored `artifacts/evidence/`. Captures may contain questions, source excerpts, selected evidence, and results. Review and sanitize them before sharing. Do not attach full captures to public issues.

## Historical benchmarks

These are measurements from **September 22, 2026** on the original local setup. They describe those samples only; they are not current performance guarantees.

| Path | Client end-to-end | GitNexus query | Reducer | Jev | Jev input tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cold current path | 37,096 ms | 1,806 ms | 0.38 ms | 278 ms | 1,213 |
| Warm first request | 1,044 ms | 788 ms | 0.23 ms | 194 ms | 953 |
| Warm repeated average (3) | 436 ms | ~271 ms | 0.02 ms | ~161 ms | 953 |

The earlier MCP run measured **1,229 ms** process startup, **1,031 ms** for the first call, and a **363 ms** repeated-call average over three requests. Benchmark scripts remain available as `npm run benchmark` and `npm run benchmark:mcp`; running them can make live Jev calls.
