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

describe("RectArea.intersection", () => {
  test("leaves a rectangle unchanged when it is already inside", () => {
    assert.deepStrictEqual(
      RectArea.from({ x: 2, y: 3, width: 4, height: 5 }).intersection({ x: 10, y: 10 }),
      { x: 2, y: 3, width: 4, height: 5 }
    );
  });

  test("clips every side to the bounds", () => {
    assert.deepStrictEqual(
      RectArea.from({ x: -2, y: -3, width: 15, height: 16 }).intersection({ x: 10, y: 10 }),
      { x: 0, y: 0, width: 10, height: 10 }
    );
  });

  test("preserves only the intersecting portion", () => {
    assert.deepStrictEqual(
      RectArea.from({ x: -3, y: 2, width: 5, height: 4 }).intersection({ x: 10, y: 10 }),
      { x: 0, y: 2, width: 2, height: 4 }
    );
  });

  test("returns null when the rectangle is entirely outside", () => {
    assert.strictEqual(
      RectArea.from({ x: -4, y: 2, width: 3, height: 4 }).intersection({ x: 10, y: 10 }),
      null
    );
  });
});

describe("RectArea.intersects", () => {
  const kRect = {
    x: 2,
    y: 2,
    width: 4,
    height: 4
  };

  test("is true when the rectangles share at least one pixel", () => {
    assert.strictEqual(
      RectArea.from(kRect).intersects({ x: 5, y: 5, width: 3, height: 3 }),
      true
    );
    assert.strictEqual(
      RectArea.from(kRect).intersects({ x: 0, y: 0, width: 10, height: 10 }),
      true
    );
  });

  test("is false when the rectangles only touch along an edge", () => {
    assert.strictEqual(
      RectArea.from(kRect).intersects({ x: 6, y: 2, width: 2, height: 4 }),
      false
    );
    assert.strictEqual(
      RectArea.from(kRect).intersects({ x: 2, y: 0, width: 4, height: 2 }),
      false
    );
  });

  test("is false when the rectangles are disjoint", () => {
    assert.strictEqual(
      RectArea.from(kRect).intersects({ x: 10, y: 10, width: 2, height: 2 }),
      false
    );
  });
});

describe("RectArea.resized", () => {
  const kRect = {
    x: 0,
    y: 0,
    width: 8,
    height: 8
  };

  test("moves the dragged corner and keeps the opposite one", () => {
    assert.deepEqual(
      RectArea.from(kRect).resized("se", { x: 2, y: -3 }).bounds,
      { x: 0, y: 0, width: 10, height: 5 }
    );
    assert.deepEqual(
      RectArea.from(kRect).resized("nw", { x: 2, y: -3 }).bounds,
      { x: 2, y: -3, width: 6, height: 11 }
    );
  });

  test("an edge handle ignores the other axis", () => {
    assert.deepEqual(
      RectArea.from(kRect).resized("n", { x: 5, y: 2 }).bounds,
      { x: 0, y: 2, width: 8, height: 6 }
    );
  });

  test("stops at 1px against the anchored edge", () => {
    assert.deepEqual(
      RectArea.from(kRect).resized("e", { x: -20, y: 0 }).bounds,
      { x: 0, y: 0, width: 1, height: 8 }
    );
    assert.deepEqual(
      RectArea.from(kRect).resized("w", { x: 20, y: 0 }).bounds,
      { x: 7, y: 0, width: 1, height: 8 }
    );
  });
});
