import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestion } from "../src/jev.mjs";

test("decision adapter builds all supported Jev question types", () => {
  assert.equal(buildQuestion("pick", ["a", "b"], "choice").type, "choice");
  assert.equal(buildQuestion("safe?", undefined, "yes-no").type, "noul");
  assert.equal(buildQuestion("risk", ["low", "high"], "score").type, "score");
});

test("choice descriptions remain available to Jev", () => {
  const question = buildQuestion("pick", { graph: "graph work", tests: "test work" }, "choice");
  assert.deepEqual(question.criteria, { graph: "graph work", tests: "test work" });
});
