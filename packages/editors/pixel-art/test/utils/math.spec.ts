// Import Node.js Dependencies
import assert from "node:assert";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { clamp } from "../../src/utils/math.ts";

describe("clamp", () => {
  it("should return the value unchanged when inside the range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
  });

  it("should return min when the value is below the range", () => {
    assert.strictEqual(clamp(-5, 0, 10), 0);
  });

  it("should return max when the value is above the range", () => {
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  it("should return the bound when the value equals min or max", () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
    assert.strictEqual(clamp(10, 0, 10), 10);
  });
});
