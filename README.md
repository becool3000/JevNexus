# JevNexus

Minimal proof of concept for a low-context repository decision layer:

```text
Codex -> repo_decide() -> GitNexus -> deterministic context reducer -> Jev -> structured decision -> Codex
```

The repository adapter owns GitNexus calls. The reducer owns the bounded state contract. The Jev adapter owns only the typed decision questions. This keeps repository navigation out of the caller and makes collection, decision, and end-to-end latency measurable independently.

## Setup

Requirements: Node.js 20+, Git, a Git repository, a GitNexus CLI, and a TypeSafe API key.

```powershell
npm install
$env:TYPESAFE_API_KEY = "..." # use a secret store in real automation
npm run index
```

`npm run index` creates the local `.gitnexus/` index. The index is intentionally ignored because it is machine-local derived state. `npm run repo:status` checks its freshness.

## Verify

```powershell
npm test
npm run repo:status
npm run repo:query -- --question "Which subsystem should be inspected for repository decisions?"
npm run verify -- --question "Verify the smallest repo decision path and choose the next bounded action."
```

The final command makes one live Jev request and prints only a summary of the reduced state, the typed answers, input/output usage when returned by the API, and timings. It does not print the full repository context. `TYPESAFE_DEFAULT_MODEL` can pin a different model version; the default is `jev-1.13.0`.

## What is verified

- GitNexus CLI is callable from the project and can index this Git repository.
- GitNexus status and graph query output can cross a small adapter boundary.
- The reducer bounds file and evidence payloads before Jev sees them.
- Jev can return a `choice` and a `noul` in one request.
- The harness records collection latency, Jev latency, end-to-end latency, reduced-state size, and API usage for later Codex comparisons.

This is intentionally not the full Codex integration. There is no Codex plugin, agent loop, automatic context policy, or persistent benchmark database yet.
