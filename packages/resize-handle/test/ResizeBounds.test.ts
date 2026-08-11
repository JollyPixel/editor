// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import { ResizeBounds } from "../src/ResizeBounds.ts";

describe("ResizeBounds", () => {
  test("defaults to non-negative unbounded sizes", () => {
    const bounds = new ResizeBounds();

    assert.equal(bounds.min, 0);
    assert.equal(bounds.max, Number.POSITIVE_INFINITY);
    assert.equal(bounds.hasMaximum, false);
  });

  test("clamps a size to both bounds", () => {
    const bounds = new ResizeBounds(100, 300);

    assert.equal(bounds.clamp(50), 100);
    assert.equal(bounds.clamp(200), 200);
    assert.equal(bounds.clamp(400), 300);
    assert.equal(bounds.hasMaximum, true);
  });

  test("rejects an invalid minimum", () => {
    for (const min of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new ResizeBounds(min, 300),
        RangeError
      );
    }
  });

  test("rejects an invalid maximum", () => {
    for (const max of [Number.NaN, Number.NEGATIVE_INFINITY, 99]) {
      assert.throws(
        () => new ResizeBounds(100, max),
        RangeError
      );
    }
  });
});
