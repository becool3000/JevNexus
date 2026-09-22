import test from "node:test";
import assert from "node:assert/strict";
import { reduceContext, validateReducedContext } from "../src/context-reducer.mjs";

test("context reducer emits a bounded, stable state shape", () => {
  const state = validateReducedContext(reduceContext({
    question: "choose a file",
    status: { data: { indexed: true, symbols: 3, relationships: 2 } },
    queryResult: "evidence",
    files: ["a.mjs", "b.mjs"],
  }));

  assert.deepEqual(state.repository, { files: ["a.mjs", "b.mjs"], fileCount: 2 });
  assert.equal(state.gitnexus.indexed, true);
  assert.equal(state.searchEvidence, "evidence");
});
