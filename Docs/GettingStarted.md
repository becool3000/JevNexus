# Install JevNexus in your coding agent

Paste the setup prompt at the top of the [README](../README.md) while your coding agent is open on the repository you want Jev to advise on. The prompt is designed for agents that can run local commands and use or configure MCP. Follow the steps below if setup stops.

## Requirements

- Git and Node.js **22.18.0–22.x or 24.11.0+**.
- Network access to GitHub, npm, and the TypeSafe API.
- A TypeSafe API key available securely to the JevNexus process. Get a key from [TypeSafe](https://console.typesafe.ai/).
- An agent host with terminal access. MCP setup also requires permission to configure or reload that host.

JevNexus does not read `.env` automatically. An environment variable is available only to processes launched with it. Never paste a secret into chat, a command argument, a tracked file, or an MCP config as a literal value.

## What the agent does

1. Find the current Git root and inspect its working tree. Decisions currently require a clean checkout. If it has changes, stop before indexing and explain that the user must decide how to preserve and clean the work. Never commit, stash, discard, or switch revisions on the user's behalf.
2. Check Node, Git, network, and whether `TYPESAFE_API_KEY` is available to the environment that will launch JevNexus. Check availability without printing the value. If unavailable, stop and explain how to configure a secure environment variable or host secret, then restart the agent. Do not write the key to a file.
3. Reuse an existing JevNexus installation when its Git checkout and dependencies are usable. Otherwise clone `https://github.com/becool3000/JevNexus.git` outside the target repository and install its locked dependencies with `npm ci --include=dev`. GitNexus is a development dependency and must be installed.
4. From the target Git root, inspect `gitnexus list` for an existing registration of that same path. Reuse its name only if the path matches. Otherwise select an unused name. Run the installed CLI from the target root:

   ```powershell
   node "C:\path\to\JevNexus\node_modules\gitnexus\dist\cli\index.js" analyze --index-only --name YourRepo
   ```

   `--index-only` indexes without injecting agent instructions or skills. Confirm `gitnexus list` shows the intended target path and alias, then run `gitnexus status --repo YourRepo --json` to confirm the index is current at the target's `HEAD`. Do not confuse the JevNexus install root with the target repository.
5. Configure the current agent to launch `node <JevNexus install>/src/mcp-server.mjs`, with its working directory set to the JevNexus install and environment values `JEVNEXUS_REPO_ROOT=<target root>` and `GITNEXUS_REPO=<registered name>`. Forward `TYPESAFE_API_KEY` through the host's secure environment mechanism. Add one unique JevNexus server entry while preserving every other setting. Prefer user-private or host-local configuration. Never overwrite a same-named server that points elsewhere.
6. If this chat cannot load the new MCP connection until a restart, use the installed CLI in the current chat for the first decision:

   ```powershell
   $env:JEVNEXUS_REPO_ROOT = "C:\path\to\YourRepo"
   $env:GITNEXUS_REPO = "YourRepo"
   node "C:\path\to\JevNexus\src\cli.mjs" decide `
     --question "Which area should I inspect first to understand this repository's main workflow?" `
     --decision-type choice `
     --choices-json '["the workflow coordinator","the subsystem it calls","insufficient evidence"]'
   ```

   Use this repository's actual terminology when forming a question. Make one small Jev request with explicit, neutral choices and an insufficient-evidence option. Show the returned choice, confidence if supplied, and model. The MCP tool becomes available after the host reloads the configuration.

Do not run tests as part of setup. Do not claim setup succeeded until a Jev decision returns successfully. An insufficient-evidence choice confirms a live request completed, but it is not a substantive recommendation.

## Official MCP setup by host

Use the official host workflow and store the key using that host's supported secret or environment-variable mechanism. Forward only `TYPESAFE_API_KEY` to this server, not the full parent-process environment. If a host's current surface cannot securely pass a key to a local process, do not place the key in its config; use the CLI in an already-secure shell or explain the missing prerequisite.

| Host | Official local MCP setup | Notes |
| --- | --- | --- |
| Codex CLI and app | `codex mcp add` or `~/.codex/config.toml` / project `.codex/config.toml` | Use `env_vars = ["TYPESAFE_API_KEY"]` to allowlist the inherited variable. Restart/reload the host when needed. [Codex MCP docs](https://developers.openai.com/codex/mcp) |
| Claude Code | `claude mcp add` with local scope, or supported MCP config | Keep it private to the project/user. Use documented environment expansion; do not put a literal key in config. [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) |
| Gemini CLI | `gemini mcp add` or `settings.json` | Explicitly map the key through `env` using supported environment expansion; Gemini filters sensitive inherited variables by default. [Gemini CLI MCP docs](https://geminicli.com/docs/tools/mcp-server/) |
| Cursor | `~/.cursor/mcp.json` or project `.cursor/mcp.json` | Use `${env:NAME}` interpolation. Prefer private user config when project files are tracked. [Cursor MCP docs](https://cursor.com/docs/mcp) |
| VS Code / Copilot | MCP: Add Server, portable `mcp.json`, or Copilot MCP config | Prefer a private user configuration when a tracked project file would dirty the target. Follow the current docs for the active Agent Host and secret input behavior. [VS Code MCP docs](https://code.visualstudio.com/docs/agent-customization/mcp-servers) |
| Cline | MCP wizard or the host's MCP settings | Verify the key is passed to this stdio process using the host's secure settings. [Cline MCP docs](https://docs.cline.bot/mcp/mcp-overview) |
| Continue | Continue MCP configuration | MCP is available in Agent mode. Use the documented environment/secret references. [Continue MCP docs](https://docs.continue.dev/customize/deep-dives/mcp) |
| Claude Desktop | Developer MCP settings / local stdio config | Restart Desktop to load changes. If no terminal-capable coding agent is available in the current conversation, the prompt cannot perform the installation there. [MCP local server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) |

These are documented integration routes, not a claim that every version or deployment has been tested with JevNexus. DeepSeek and local models need an agent host that supports local commands and MCP tools. A chat-only model surface without terminal access cannot install JevNexus. Cloud or container agents need Git, Node, repository files, credentials, and network access in their execution environment. JevNexus currently exposes local stdio MCP; its optional HTTP API is not a remote MCP endpoint.

## Data and troubleshooting

- GitNexus indexing and JevNexus retrieval run locally. `repo_decide` sends the question, choices, and selected repository context to TypeSafe for Jev.
- `debug` controls whether selected context is included in the tool response. It does not control whether context is sent to Jev.
- Diagnostic recording is opt-in and writes local files beneath ignored `artifacts/evidence/`. Captures can contain source code, questions, and results. Review before sharing.

| Problem | Next step |
| --- | --- |
| Unsupported Node or dependency install error | Use Node 22.18.0–22.x or 24.11.0+, confirm Git and npm network access, then run `npm ci --include=dev` in the JevNexus install. |
| Repository has changes | Setup stops because JevNexus currently requires a clean target checkout. Review your changes and decide how to preserve them before cleaning the tree; the installer must not do this for you. |
| GitNexus cannot find the target | Run its CLI with the target Git root as the working directory. Check `gitnexus list` for the exact path and alias. |
| Index is stale | Re-run `analyze --index-only --name YourRepo` from the target root. Confirm the indexed commit matches `git rev-parse HEAD`. |
| MCP lists no JevNexus tools | Check the executable path, install root, working directory, target root, alias, and host's key forwarding. Reload the host and inspect its MCP logs. |
| JevNexus says the API key is unavailable | Configure `TYPESAFE_API_KEY` for the environment that launches the server or CLI. Restart that process; do not add the secret to chat or a config file. |
| Jev returns insufficient evidence | Treat it as unresolved. Review relevant source, then ask a narrower question or improve the index before asking again. |
| Decision fails with an API error | Check that the key is valid for TypeSafe and that the execution environment can reach the API. Do not repeatedly retry a request that may have reached the service. |

Report setup problems or weak Jev recommendations through the [GitHub issue forms](https://github.com/becool3000/JevNexus/issues/new/choose). Include host/version, failed step, and sanitized error lines. Never include keys, private source, or full diagnostic bundles.

## Further reference

- [MCP and HTTP reference](Reference.md)
- [Evidence collection design and historical comparison](JevNexus.md)
- [GitNexus documentation](https://github.com/abhigyanpatwari/GitNexus)
- [Official TypeSafe JavaScript SDK docs](https://docs.typesafe.ai/sdk/javascript)
- [TypeSafe terms](https://typesafe.ai/legal/terms)
