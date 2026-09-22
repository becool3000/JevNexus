export const DEFAULT_CHOICE_CRITERIA = {
  inspect_gitnexus_adapter: "Inspect or improve the GitNexus adapter or context reducer.",
  inspect_jev_adapter: "Inspect or improve the Jev adapter or decision contract.",
  run_tests: "Run the repository's tests or verification command.",
  ask_codex_for_deeper_reasoning: "The evidence is insufficient; Codex should reason more deeply.",
  no_action: "The current evidence is sufficient and no further action is needed.",
};

export function normalizeDecisionType(value, hasChoices) {
  const normalized = String(value || (hasChoices ? "choice" : "noul")).toLowerCase();
  if (["choice", "noul", "score"].includes(normalized)) return normalized;
  if (["yes-no", "yes_no", "boolean"].includes(normalized)) return "noul";
  throw new Error(`Unsupported decisionType '${value}'. Use choice, noul, or score.`);
}

export function normalizeChoiceCriteria(choices) {
  const selected = choices ?? DEFAULT_CHOICE_CRITERIA;
  if (Array.isArray(selected)) {
    if (selected.length < 2) throw new Error("choice decisions need at least two choices.");
    return Object.fromEntries(selected.map((label) => [String(label), null]));
  }
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    throw new Error("choice decisions need an array or label-to-description object.");
  }
  if (Object.keys(selected).length < 2) throw new Error("choice decisions need at least two choices.");
  return selected;
}

export function normalizeScoreCriteria(choices) {
  if (!Array.isArray(choices) || choices.length < 2) {
    throw new Error("score decisions need an ordered array with at least two levels.");
  }
  if (choices.length > 10) throw new Error("score decisions support at most ten levels.");
  return choices;
}

export function normalizeNoulCriteria(choices) {
  if (choices === undefined) return undefined;
  if (!choices || typeof choices !== "object" || Array.isArray(choices)) {
    throw new Error("noul choices must be an object with optional yes and no descriptions.");
  }
  const allowed = {};
  if (choices.yes !== undefined) allowed.yes = choices.yes;
  if (choices.no !== undefined) allowed.no = choices.no;
  return Object.keys(allowed).length === 0 ? undefined : allowed;
}
