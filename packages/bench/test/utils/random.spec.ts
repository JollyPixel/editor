// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { mulberry32 } from "../../src/utils/random.ts";

describe("mulberry32", () => {
  it("should yield the same sequence for the same seed", () => {
    function take(
      seed?: number
    ): number[] {
      const next = mulberry32(seed);

      return Array.from({ length: 8 }, next);
    }

    assert.deepEqual(take(42), take(42));
    assert.deepEqual(take(), take());
    assert.notDeepEqual(take(42), take(43));
  });

  it("should stay within [0, 1)", () => {
    const next = mulberry32(7);

    for (let i = 0; i < 1_000; i++) {
      const value = next();
      assert.ok(value >= 0 && value < 1, String(value));
    }
  });
});
