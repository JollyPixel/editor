// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { centeredGridPositions } from "../../examples/scripts/preview/centeredGrid.ts";

describe("centeredGridPositions", () => {
  test("returns no positions for an empty gallery", () => {
    assert.deepStrictEqual(centeredGridPositions(0, 2), []);
  });

  test("centers a single preview", () => {
    assert.deepStrictEqual(
      centeredGridPositions(1, 2).map(({ x, y, z }) => [x, y, z]),
      [[0, 0, 0]]
    );
  });

  test("uses a centered near-square layout", () => {
    assert.deepStrictEqual(
      centeredGridPositions(3, 2).map(({ x, y, z }) => [x, y, z]),
      [
        [-1, 1, 0],
        [1, 1, 0],
        [-1, -1, 0]
      ]
    );
  });
});
