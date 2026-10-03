# JevNexus

JevNexus helps a coding assistant answer one focused question about a codebase using source evidence. It searches the GitNexus index, follows likely symbols through their callers and callees, and gives Jev a bounded evidence bundle for a typed decision.

For example: **“Where is repository evidence gathered before a Jev decision?”** You can preview the answer and its source references locally before connecting an API key.

## Try an evidence preview

Requirements: Git and Node.js **22.18.0–22.x, or 24.11.0 and newer**. GitNexus is installed locally from the lockfile; no global install is needed.

```powershell
git clone https://github.com/becool3000/JevNexus.git
cd JevNexus
npm ci
npm run index
npm run repo:evidence -- --question "Where is repository evidence gathered before a Jev decision?"
```

This creates a local `.gitnexus/` index, then prints a JSON preview. A successful preview includes `ok: true`, index freshness, candidate symbols, source locations, relationships, and any retrieval limits or omissions. Candidate ranking depends on the repository and question. The preview does not call Jev and does not require `TYPESAFE_API_KEY`.

![Selected fields from a real PowerShell evidence preview on Node.js 22.20.0](Docs/images/quickstart-preview.png)

The image shows selected fields from a successful fresh-clone run at revision `282b0f95`; machine-local paths and the rest of the JSON are omitted.

The index is derived local data. Refresh it after changing source files; `npm run index` uses GitNexus `--index-only` so it does not write agent instructions or skills into the checkout.

## Next steps

- [Let your coding agent set it up](Docs/GettingStarted.md#agent-assisted-setup): copy a prompt that installs prerequisites, indexes JevNexus, verifies a local preview, and configures MCP where supported.
- [Preview and decision guide](Docs/GettingStarted.md): Codex MCP setup, data flow, and troubleshooting.
- [Tool and service reference](Docs/Reference.md): MCP schemas, HTTP requests, and historical benchmarks.
- [Evidence collection and comparison notes](Docs/JevNexus.md): collection limits, known retrieval limitations, and the CityBuilder comparison.
- To ask Jev for a decision, configure a TypeSafe API key as an environment variable, then use `repo_decide`. Decisions require a clean checkout and a current index. Jev receives the question, choices, and selected source evidence.

Indexing and preview collection run locally. Preview output contains repository evidence. A Jev decision sends the question, choices, and selected evidence to TypeSafe. Diagnostics are opt-in, remain local by default, and may contain source code. Review them before sharing.

## Dependencies and terms

JevNexus currently has no `LICENSE` file. GitNexus 1.6.12, the installed dependency, declares the [PolyForm Noncommercial License](https://www.npmjs.com/package/gitnexus). Review the terms of JevNexus and its dependencies before reuse, especially for commercial use; no license has been selected for this project.

- [GitNexus repository and documentation](https://github.com/abhigyanpatwari/GitNexus)
- [TypeSafe JavaScript SDK guide](https://www.typesafeai.org/guides/jev-typescript)
- [TypeSafe terms of use](https://typesafe.ai/legal/terms)

Report install issues or weak evidence with the [GitHub issue forms](https://github.com/becool3000/JevNexus/issues/new/choose). Include sanitized excerpts only; do not attach API keys or full private evidence bundles.
