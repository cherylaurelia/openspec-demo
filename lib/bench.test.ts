import { test } from "node:test";
import assert from "node:assert/strict";
import { runIsGood } from "./bench-logic.ts";

test("entering is good only when the prompt expects it", () => {
  assert.equal(runIsGood("enter", "openspec_first"), true);
  assert.equal(runIsGood("enter", "code_first"), false);
  assert.equal(runIsGood("enter", "neither"), false);
  assert.equal(runIsGood("skip", "openspec_first"), false);
  assert.equal(runIsGood("skip", "code_first"), true);
  assert.equal(runIsGood("skip", "neither"), true);
});
