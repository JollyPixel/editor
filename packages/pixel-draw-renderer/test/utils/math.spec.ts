// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { clamp } from "../../src/utils/math.ts";

describe("clamp", () => {
  test("returns the value unchanged when within range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
  });

  test("returns min when value is below range", () => {
    assert.strictEqual(clamp(-5, 0, 10), 0);
  });

  test("returns max when value is above range", () => {
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  test("is inclusive of the min bound", () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
  });

  test("is inclusive of the max bound", () => {
    assert.strictEqual(clamp(10, 0, 10), 10);
  });

  test("works with negative ranges", () => {
    assert.strictEqual(clamp(-20, -10, -1), -10);
  });
});
