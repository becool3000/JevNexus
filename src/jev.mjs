import { choice, noul, TypeSafeClient } from "@typesafe-ai/sdk";
import { jevModel, requireApiKey } from "./config.mjs";

export async function decide(state) {
  requireApiKey();
  const client = new TypeSafeClient({ defaultModel: jevModel });
  return client.systemOne({
    model: jevModel,
    state,
    questions: {
      next_action: choice("Which bounded action should Codex take next for this repository task?", {
        inspect_gitnexus_adapter: "Inspect or improve the GitNexus adapter/context reducer.",
        inspect_jev_adapter: "Inspect or improve the Jev adapter or decision contract.",
        run_tests: "Run the repository's tests or verification command.",
        ask_codex_for_deeper_reasoning: "The evidence is insufficient; Codex should reason more deeply.",
        no_action: "The current evidence is sufficient and no further action is needed.",
      }),
      needs_more_context: noul("Is more repository context needed before taking a bounded next action?"),
    },
  });
}
