// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { RectArea } from "#src/utils/RectArea.ts";

describe("RectArea", () => {
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

  test("fits within bounds only when the complete area is inside", () => {
    const area = RectArea.from({
      x: 1,
      y: 2,
      width: 3,
      height: 2
    });
    const leftOfOrigin = RectArea.from({
      x: -1,
      y: 2,
      width: 3,
      height: 2
    });

    assert.strictEqual(area.fitsWithin({ x: 4, y: 4 }), true);
    assert.strictEqual(area.fitsWithin({ x: 3, y: 4 }), false);
    assert.strictEqual(leftOfOrigin.fitsWithin({ x: 4, y: 4 }), false);
  });
});
