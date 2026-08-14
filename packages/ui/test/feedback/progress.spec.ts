// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { normalizeProgress } from "../../src/feedback/normalizeProgress.ts";

describe("normalizeProgress", () => {
  test("keeps a missing value indeterminate", () => {
    assert.deepStrictEqual(
      normalizeProgress(null, 100),
      {
        max: 100,
        value: null,
        ratio: null
      }
    );
  });

  test("clamps determinate values to their bounds", () => {
    assert.deepStrictEqual(
      normalizeProgress(-2, 10),
      {
        max: 10,
        value: 0,
        ratio: 0
      }
    );
    assert.deepStrictEqual(
      normalizeProgress(12, 10),
      {
        max: 10,
        value: 10,
        ratio: 1
      }
    );
  });

  test("falls back from invalid numbers", () => {
    assert.deepStrictEqual(
      normalizeProgress(Number.NaN, 0),
      {
        max: 1,
        value: 0,
        ratio: 0
      }
    );
    assert.deepStrictEqual(
      normalizeProgress(Number.POSITIVE_INFINITY, Number.NaN),
      {
        max: 1,
        value: 0,
        ratio: 0
      }
    );
  });

  test("preserves an in-range ratio", () => {
    assert.deepStrictEqual(
      normalizeProgress(3, 8),
      {
        max: 8,
        value: 3,
        ratio: 0.375
      }
    );
  });
});
