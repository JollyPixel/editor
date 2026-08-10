// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RectArea } from "#src/utils/RectArea.ts";

describe("RectArea", () => {
  test("iterates cells in row-major order with local source indices", () => {
    const cells = [...RectArea.from({
      x: 4,
      y: 7,
      width: 2,
      height: 2
    })];

    assert.deepStrictEqual(cells, [
      { x: 4, y: 7, localX: 0, localY: 0, sourceIndex: 0 },
      { x: 5, y: 7, localX: 1, localY: 0, sourceIndex: 1 },
      { x: 4, y: 8, localX: 0, localY: 1, sourceIndex: 2 },
      { x: 5, y: 8, localX: 1, localY: 1, sourceIndex: 3 }
    ]);
  });

  test("clips rows while preserving indices in the original area", () => {
    const area = RectArea.from({
      x: -1,
      y: -1,
      width: 3,
      height: 3
    });

    assert.deepStrictEqual(
      [...area.rowsWithin({ x: 2, y: 2 })],
      [
        { x: 0, y: 0, length: 2, sourceIndex: 4, indexInBounds: 0 },
        { x: 0, y: 1, length: 2, sourceIndex: 7, indexInBounds: 2 }
      ]
    );
  });

  test("returns no rows when the area is outside the bounds", () => {
    const area = RectArea.from({
      x: 5,
      y: 5,
      width: 2,
      height: 2
    });

    assert.deepStrictEqual(
      [...area.rowsWithin({ x: 2, y: 2 })],
      []
    );
  });

  test("computes the in-bounds area around a set of positions", () => {
    const area = RectArea.bounding([
      { x: -1, y: 1 },
      { x: 4, y: 1 },
      { x: 1, y: 3 },
      { x: 3, y: 2 }
    ], { x: 4, y: 4 });

    assert.deepStrictEqual(
      area?.bounds,
      { x: 1, y: 2, width: 3, height: 2 }
    );
  });

  test("reports containment and whether the complete area fits", () => {
    const area = RectArea.from({
      x: 1,
      y: 2,
      width: 3,
      height: 2
    });

    assert.strictEqual(area.contains({ x: 3, y: 3 }), true);
    assert.strictEqual(area.contains({ x: 4, y: 3 }), false);
    assert.strictEqual(area.fitsWithin({ x: 4, y: 4 }), true);
    assert.strictEqual(area.fitsWithin({ x: 3, y: 4 }), false);
  });
});
