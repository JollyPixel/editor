// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NumberRange } from "../../../src/components/camera/orbit-fly/NumberRange.ts";

describe("Components.Camera.NumberRange", () => {
  test("should clamp values on both sides", () => {
    const range = new NumberRange(2, 240);

    assert.deepStrictEqual(
      [range.clamp(0), range.clamp(18), range.clamp(500)],
      [2, 18, 240]
    );
  });

  test("should refuse inverted or undefined bounds", () => {
    for (const [min, max] of [[5, 1], [Number.NaN, 1]]) {
      assert.throws(() => new NumberRange(min, max), RangeError);
    }
  });
});
