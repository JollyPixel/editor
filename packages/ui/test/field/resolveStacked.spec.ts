// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { resolveStacked } from "../../src/field/LabelStackController.ts";

describe("resolveStacked", () => {
  test("stacks a row narrower than the threshold", () => {
    assert.equal(resolveStacked(199, 200, false), true);
  });

  test("keeps a row at or above the threshold inline", () => {
    assert.equal(resolveStacked(200, 200, true), false);
    assert.equal(resolveStacked(480, 200, true), false);
  });

  test("keeps the previous layout while the row has no width", () => {
    assert.equal(resolveStacked(0, 200, true), true);
    assert.equal(resolveStacked(0, 200, false), false);
  });
});
