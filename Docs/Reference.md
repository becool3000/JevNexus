# MCP, HTTP, and benchmark reference

## The Jev decision

`repo_decide` is the main JevNexus operation. It gathers bounded code context from the configured GitNexus index, sends the question, optional choices, and selected context to Jev through TypeSafe, and returns Jev's recommendation. It requires a valid `TYPESAFE_API_KEY`, a clean checkout, and a GitNexus index matching the current source revision.

```text
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

`choice` needs at least two choices. `noul` is a yes/no decision and may use `{ "yes": "...", "no": "..." }`. `score` uses an ordered array of 2–10 rubric levels. Successful results contain `ok`, a typed decision, model, and timing/token metrics. Invalid arguments and dependency failures return structured errors without including API key material.

`debug: true` includes selected context in the response to the agent. It does not control whether context is sent to Jev. Keep it off for ordinary use.

## MCP tools

The stdio server exposes two tools. Connect your agent to JevNexus using the [getting started guide](GettingStarted.md), then call `repo_decide` for a recommendation. `repo_evidence` is a secondary retrieval diagnostic for troubleshooting; it returns selected context to the agent without calling Jev.

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
```

Diagnostics are disabled by default. `recordDiagnostics: true` writes a local capture that may contain questions and source code; inspect it before sharing. MCP errors distinguish missing keys, stale indexes, dirty checkouts, and retrieval failures.

## Local HTTP service

Start the optional warm local service with `npm run warm:start`. It listens on `127.0.0.1:4850` by default. Set `JEVNEXUS_PORT` to change the port. The service provides `POST /repo_decide` and a secondary `POST /evidence` diagnostic route; requests use the same question, choice, and decision-type fields as the MCP tools. Check `/health` for service state.

Example PowerShell decision request:

```powershell
$body = @{
  question = "Which subsystem should Jev recommend inspecting next?"
  choices = @{
    "the decision adapter" = "Code that sends context to Jev and returns a recommendation"
    "the retrieval adapter" = "Code that gathers source context from GitNexus"
    "insufficient evidence" = "The available source context does not distinguish them"
  }
  decisionType = "choice"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:4850/repo_decide `
  -ContentType "application/json" -Body $body
```

The HTTP service binds to localhost. It is not a remote MCP endpoint.

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
