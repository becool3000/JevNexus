import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";
import { jevModel, requireApiKey } from "./config.mjs";
import {
  normalizeChoiceCriteria,
  normalizeDecisionType,
  normalizeNoulCriteria,
  normalizeScoreCriteria,
} from "./decision-spec.mjs";

export function buildQuestion(question, choices, decisionType) {
  const type = normalizeDecisionType(decisionType, choices !== undefined);
  if (type === "choice") return choice(question, normalizeChoiceCriteria(choices));
  if (type === "score") return score(question, normalizeScoreCriteria(choices));
  return noul(question, normalizeNoulCriteria(choices));
}

export async function decide(state, { question, choices, decisionType } = {}) {
  requireApiKey();
  const client = new TypeSafeClient({ defaultModel: jevModel });
  return client.systemOne({
    model: jevModel,
    state,
    questions: {
      decision: buildQuestion(question, choices, decisionType),
    },
  });
}
