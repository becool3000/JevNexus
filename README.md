# JevNexus

JevNexus gives Jev useful context about a code repository so Jev can return a focused, source-grounded recommendation. GitNexus works behind the scenes to find relevant code; JevNexus packages that context and sends it with your question to Jev.

For example, ask Jev: **“Which part of this repository should I inspect first to understand how vehicle movement conflicts are resolved?”** JevNexus gathers relevant code and relationships, then Jev returns a recommendation with supporting context.

## Install with your coding agent

**This is the recommended setup.** First make sure `TYPESAFE_API_KEY` is securely available in the environment inherited by your coding agent. Then paste this prompt while the agent is working in the repository you want Jev to reason about. Repeat it for another repository so JevNexus indexes and targets that project too.

```text
Set up JevNexus for this chat's current Git repository so I can ask Jev for recommendations.

Check that TYPESAFE_API_KEY is available to this agent without printing its value. If missing, stop and tell me to configure it securely. Find this repository's root. Clone JevNexus outside the project and run `npm ci` there to install all dependencies, including GitNexus. From the project root, run the installed CLI:

`node "<JevNexus>/node_modules/gitnexus/dist/cli/index.js" analyze --index-only --name <repo-alias>`

Configure MCP to use the JevNexus install, set `JEVNEXUS_REPO_ROOT` to this project and `GITNEXUS_REPO` to the same alias, and inherit the API key securely. Preserve existing settings and follow this agent's official setup instructions.

Use Git and Node.js 22.18+ (22.x) or 24.11+. If missing, use official installers. Do not expose the key, write it to files, or run tests or a Jev request during setup. Finish by confirming the index is current, MCP is configured, and whether I need to reload this chat.
```

Paste it while your agent is working in the repository you want Jev to analyze. The agent needs terminal and MCP configuration access. See the [setup guide](Docs/GettingStarted.md) if it cannot configure MCP itself.

## Next steps

- [Jev setup and usage guide](Docs/GettingStarted.md): manual TypeSafe key setup, Codex MCP configuration, data flow, and troubleshooting.
- [Tool and service reference](Docs/Reference.md): MCP schemas, HTTP requests, and historical benchmarks.
- [Evidence collection and comparison notes](Docs/JevNexus.md): collection limits, known retrieval limitations, and the CityBuilder comparison.
- `repo_decide` is the primary workflow. `repo_evidence` is a supporting diagnostic for inspecting what context JevNexus selected.

Repository indexing and retrieval run locally. A Jev decision sends the question, choices, and selected repository context to TypeSafe. Diagnostics are opt-in, remain local by default, and may contain source code. Review them before sharing.

## License and dependencies

JevNexus-authored code is licensed under the [MIT License](LICENSE). This license covers the original work in this repository; third-party dependencies retain their own terms. In particular, GitNexus 1.6.12 is installed as a dependency under the [PolyForm Noncommercial License](https://polyformproject.org/licenses/noncommercial/1.0.0). Review those separate terms before commercial use.

- [GitNexus repository and documentation](https://github.com/abhigyanpatwari/GitNexus)
- [TypeSafe JavaScript SDK guide](https://www.typesafeai.org/guides/jev-typescript)
- [TypeSafe terms of use](https://typesafe.ai/legal/terms)

Report install issues or weak evidence with the [GitHub issue forms](https://github.com/becool3000/JevNexus/issues/new/choose). Include sanitized excerpts only; do not attach API keys or full private evidence bundles.
