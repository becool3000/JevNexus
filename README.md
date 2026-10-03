# JevNexus

**Ask Jev about the repo you’re working in.**

JevNexus uses GitNexus to find relevant code and gives Jev the context to recommend a next step.

**Paste this into your coding agent’s chat:**

```text
Install https://github.com/becool3000/JevNexus for the Git repository open in this chat. Follow its Docs/GettingStarted.md.

Set up the dependencies, index this repository, and connect this agent. Preserve my existing configuration and source changes. Use TYPESAFE_API_KEY securely; never ask me to paste the key into chat or expose it in commands or configuration files.

Ask Jev one small, useful question about this repository and show its recommendation. Use MCP if available now, otherwise the CLI. I authorize that one API request and sending the selected repository context to TypeSafe.

If blocked, tell me the exact next step. Do not commit, stash, discard changes, or run tests.
```

**Requires:** a coding agent with terminal access and a TypeSafe API key. Jev API usage may incur charges. Get API access from [TypeSafe](https://console.typesafe.ai/).

Indexing and retrieval run locally. A Jev decision sends your question, choices, and selected repository context to TypeSafe. MCP needs a current index and a clean repository checkout.

- [Install and troubleshoot](Docs/GettingStarted.md)
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [Technical reference](Docs/Reference.md)

## License and dependencies

JevNexus-authored code is licensed under the [MIT License](LICENSE). Dependencies retain their own terms. The pinned GitNexus 1.6.12 dependency uses the [PolyForm Noncommercial License](https://polyformproject.org/licenses/noncommercial/1.0.0); review its terms before commercial use.

- [GitNexus source and documentation](https://github.com/abhigyanpatwari/GitNexus)
- [TypeSafe terms](https://typesafe.ai/legal/terms)
- [Report an installation or recommendation problem](https://github.com/becool3000/JevNexus/issues/new/choose)

Do not include API keys, private source code, or complete diagnostic captures in public issues.
