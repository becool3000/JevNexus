# JevNexus Retrieval Design and Comparison

This document records the collector design and an earlier repository comparison. See [Getting started](GettingStarted.md) for first use and [the tool reference](Reference.md) for MCP and HTTP request details.

## Advisory use

JevNexus gathers bounded code context through GitNexus so Jev can make an advisory recommendation about one repository question. Treat the recommendation as an investigation lead and confirm it against the source before making a change. This document records how collection works and preserves the historical comparison.

## Collection and limits

The collector uses the GitNexus MCP `query` and `context` tools. It runs the original question first, then up to two deterministic related searches. It gathers results in request order, merges symbols by stable GitNexus ID, and expands at most six candidates to their direct callers and callees. Graph neighbors are included as evidence but are not recursively expanded.

Default bounds are three searches, six context lookups, one graph hop, two in-flight requests, and 24,000 characters for the complete state sent to Jev. Search results from the original question carry more rank weight than secondary searches. Selection prefers relevant symbol definitions over whole-file nodes and test symbols unless the question is about tests. Stable IDs break score ties. Candidates and relationships are kept as complete blocks; omitted evidence is counted and identified.

The bundle hash is calculated from canonical JSON and excludes timing and run IDs. Metrics report a conservative token estimate using 2.5 characters per token, plus actual input/output token counts after live Jev calls. The installed TypeSafe SDK does not expose an authoritative context-window limit, so the character budget is not a model guarantee.

## Decision and diagnostic interface

From the JevNexus project root:

```powershell
node src/cli.mjs decide `
  --question "Where does this repository connect GitNexus retrieval to Jev?" `
  --decision-type choice `
  --choices-json '["the decision layer","the retrieval layer","insufficient evidence"]'
```

The primary interface is `repo_decide`, which performs the collection and asks Jev. `repo_evidence` exists as a secondary troubleshooting tool; it returns selected context without a Jev request. Set `recordDiagnostics: true` to write raw GitNexus results, selected evidence, omissions, source revision, and timings beneath ignored `artifacts/evidence/`. Diagnostic files can contain repository source text and should remain local unless their contents are reviewed before sharing.

`repo_decide` requires both a clean repository snapshot and a GitNexus index whose commit matches that snapshot. Retrieval diagnostics can report freshness for dirty or stale sources, but they do not produce a Jev recommendation.

## Refresh

After changing indexed source, refresh the derived GitNexus index from the target repository:

```powershell
npm run index
```

For another checkout, run the GitNexus analyzer with that checkout as its working directory. Confirm `gitnexus status --json` reports `status: up-to-date` and that `index.commit` matches the checkout's `HEAD` before making a Jev decision. Index databases and raw diagnostic captures remain ignored by Git.

## Historical comparison record (October 2, 2026)

The first JevNexus trial on CityBuilder used a different source revision (`eb78ea60734849ff0fbab0d95df08eacb87f3f19`) and returned **Simulation controller** at confidence **0.29**. The current comparison is recorded separately against CityBuilder revision `e86d985dea70b3fbee1f62757c0f10018a2c39c3`; those different revisions are not treated as a controlled before/after result.

Codex recorded its expected answers and supporting symbols before reading each Jev response. The live runs used the same CityBuilder revision and a clean checkout. The original traffic question used the previously agreed four choices.

| Question | Codex source answer | Jev result | Evidence and timing |
| --- | --- | --- | --- |
| Where should we inspect competing roadside admissions and in-progress movements? | `CityTrafficResolver.Resolve` decides accepted moves; `CitySimulationController.AdvanceRoadTraffic` builds intents and commits accepted progress. | Traffic resolver, confidence **1.00**. | Both definitions and their direct call relationships were selected. Evidence collection **4.02 s**; Jev **0.33 s**; full decision **4.43 s**; Jev reported **8,215 input tokens**. |
| What advances the paused/speed-scaled fixed-step clock? | `CitySimulationController.Update` → `AccumulateFixedSteps` → `StepSimulation`. | Fixed-step clock path, confidence **0.99**. | Relevant controller definition selected. Collection **4.96 s**; Jev **0.30 s**; full decision **5.29 s**; **9,887 input tokens**. |
| How are old city saves validated before replacing current state? | `CityRuntimeController.LoadSlot` runs `CityRules.ValidateSnapshot` and `CitySimulationController.ValidateSnapshot` before `ReplaceState`/restore migration. | Coordinated load and validation path, confidence **1.00**. | Load coordinator and simulation validator selected. Collection **3.58 s**; Jev **0.11 s**; full decision **3.69 s**; **6,837 input tokens**. |
| Where are resident grants, rent, food allowance, and production wages centralized? | `CityAccountingService`, called by the simulation controller. | Correct choice, confidence **0.18**; probability for `CityAccountingService` was **0.38**, with insufficient evidence at **0.37**. | Retrieval expanded unrelated inspection, rules, and budget-report symbols; it did not include the accounting service implementation. This is a weak-evidence result, not a strong confirmation. Collection **2.94 s**; Jev **0.19 s**; full decision **3.13 s**; **9,690 input tokens**. |

One direct MCP measurement put server startup at **1.56 s**. A later evidence preview took **3.80 s** end to end, including **0.46 s** for index status, **2.69 s** for searches, **0.72 s** for context expansion, and **0.03 s** for evidence selection. It selected **22,454 characters**, with a conservative estimate of **8,982 tokens**. The source snapshot remained clean and the GitNexus index matched `e86d985`.

The index reported 569 files, 1,903 graph nodes, and 4,823 edges, with vector search unavailable and zero embeddings. The accounting result exposes the practical retrieval boundary: natural-language terms did not lead the bounded searches to the relevant implementation. Jev’s near tie with “insufficient evidence” reflected that gap. The current source changes preserve those first valid Jev answers; no answer was rerun to replace a low-confidence result.

The Codex source notes, raw search/context responses, reduced bundles, omissions, and live results are in ignored local files under `artifacts/evidence/`. This small comparison demonstrates a useful code entry point and a visible failure mode; it does not establish general answer accuracy or speed gains.
