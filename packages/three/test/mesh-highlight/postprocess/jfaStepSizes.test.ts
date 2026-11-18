// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { jfaStepSizes } from "#src/mesh-highlight/postprocess/tsl/jfa/propagate.ts";

describe("jfaStepSizes", () => {
  test("starts at the smallest power of two that reaches the distance, then halves to one twice", () => {
    const cases = [
      [1, [1, 1]],
      [3, [2, 1, 1]],
      [4, [4, 2, 1, 1]],
      [7, [4, 2, 1, 1]],
      [8, [8, 4, 2, 1, 1]]
    ] as const;

    for (const [reach, steps] of cases) {
      assert.deepStrictEqual(jfaStepSizes(reach), steps, `reach ${reach}`);
    }
  });
});
