# Getting JevNexus running

## Recommended: install from your agent chat

The quickest setup is the copyable **Install with your coding agent** prompt at the top of the [README](../README.md#install-with-your-coding-agent). Paste it while your agent is open in the Git repository you want Jev to reason about. It checks that a Jev API key is available, installs JevNexus and its dependencies, indexes the current repository with GitNexus, and configures the agent's MCP connection.

Run the prompt again from another project to index and target that repository. The agent needs terminal access and permission to edit its MCP configuration. If the key is missing, configure it securely in your operating system or secret manager, restart the agent, and then paste the prompt again. Never paste the key into chat or save it in the repository.

## Manual setup

Requirements: Git, Node.js **22.18.0–22.x or 24.11.0+**, and a TypeSafe API key available to the CLI and MCP process. The installed GitNexus package requires this Node range. JevNexus does not automatically load `.env` files.

Clone and install JevNexus outside the project you want to analyze:

```powershell
git clone https://github.com/becool3000/JevNexus.git
cd JevNexus
npm ci
```

`npm ci` installs the locked JevNexus dependencies, including GitNexus. Keep the JevNexus installation path separate from the target repository path.

Index the target repository with the installed GitNexus CLI. Run this from the target repository root so GitNexus registers the correct project:

```powershell
node "C:\path\to\JevNexus\node_modules\gitnexus\dist\cli\index.js" analyze --index-only --name YourProject
```

Use the same name for `GITNEXUS_REPO` in the MCP configuration. This indexes the current repository without installing skills or writing agent instructions. Refresh the index after source changes. Confirm the index matches the target repository's current `HEAD` before making decisions.

## Ask Jev from the command line

Make sure `TYPESAFE_API_KEY` is available in the shell environment. Do not put its value directly in a command or repository file. Set the two repository variables to the project you indexed:

```powershell
$env:JEVNEXUS_REPO_ROOT = "C:\path\to\YourProject"
$env:GITNEXUS_REPO = "YourProject"

npm run decide -- --question "Which area should I inspect first to understand the traffic resolver?" --decision-type choice --choices-json '["simulation controller","traffic resolver","road topology"]'
```

JevNexus sends the question, choices, and selected repository context to TypeSafe, where Jev returns one bounded recommendation. Decisions require a clean target checkout and a current GitNexus index.

## Connect Codex

Add an MCP server entry to `~/.codex/config.toml`. Point it at the JevNexus installation and set the target repository path and GitNexus registration name. Codex inherits the API key named in `env_vars` from its environment; do not put the secret value in this file.

```toml
[mcp_servers.jevnexus]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\path\to\JevNexus\src\mcp-server.mjs']
cwd = 'C:\path\to\JevNexus'
env = { JEVNEXUS_REPO_ROOT = 'C:\path\to\YourProject', GITNEXUS_REPO = 'YourProject' }
env_vars = ["TYPESAFE_API_KEY"]
startup_timeout_sec = 60
tool_timeout_sec = 60
enabled = true
enabled_tools = ["repo_decide", "repo_evidence"]
```

Replace the example paths and alias. Preserve existing MCP settings when editing the file, then restart or reload Codex. This entry targets the repository named in `JEVNEXUS_REPO_ROOT`; update it when connecting another project.

## Data handling

- GitNexus indexing and JevNexus evidence collection run locally.
- The `repo_decide` request sends the question, choices, and selected repository context to TypeSafe for Jev's recommendation.
- `repo_evidence` is a supporting diagnostic tool; it returns the selected context without a Jev call.
- `recordDiagnostics` is opt-in and writes files under `artifacts/evidence/`. Captures may contain questions, source excerpts, and results. Review and sanitize before sharing.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Unsupported Node version or engine warning | Run `node --version`; use Node 22.18.0–22.x or 24.11.0 and newer. |
| Dependency installation fails | Confirm Git, supported Node, network access to npm, and that `package-lock.json` is present; retry with `npm ci`. |
| GitNexus cannot find the target project | Run `analyze --index-only` with the target repository as the current working directory. |
| Jev says the index is stale | Re-index the target after source changes and confirm the index commit matches its `HEAD`. |
| JevNexus reports a missing API key | Set `TYPESAFE_API_KEY` securely in the environment inherited by the CLI or MCP process, then restart it. |
| Codex does not list JevNexus tools | Check `command`, `args`, `cwd`, `JEVNEXUS_REPO_ROOT`, `GITNEXUS_REPO`, and key inheritance; reload Codex and inspect its MCP startup log. |
| Jev's recommendation seems unsupported | Use `repo_evidence` as a diagnostic, inspect the cited source yourself, and treat missing or omitted evidence as uncertainty. |

For install issues, use the [installation issue form](https://github.com/becool3000/JevNexus/issues/new?template=installation.yml). For retrieval quality, use the [evidence issue form](https://github.com/becool3000/JevNexus/issues/new?template=evidence-quality.yml). Share sanitized excerpts only; never share API keys or complete private evidence bundles.

## Further reference

- [Evidence collection and comparison record](JevNexus.md)
- [MCP and HTTP reference](Reference.md)
- [GitNexus repository and documentation](https://github.com/abhigyanpatwari/GitNexus)
- [TypeSafe JavaScript SDK guide](https://www.typesafeai.org/guides/jev-typescript)
- [TypeSafe terms of use](https://typesafe.ai/legal/terms)
