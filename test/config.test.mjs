import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { packageRoot, resolveRepoRoot } from "../src/config.mjs";

test("repository root defaults to the JevNexus installation", () => {
  assert.equal(resolveRepoRoot(""), packageRoot);
});

test("repository root can target a different indexed project", () => {
  assert.equal(resolveRepoRoot("D:/LiveSand3D/LiveSand3D"), path.resolve("D:/LiveSand3D/LiveSand3D"));
});
