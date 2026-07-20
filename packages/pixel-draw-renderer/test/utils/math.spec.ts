// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { clamp, clampRectPosition, clampRectSize, pointInRect } from "../../src/utils/math.ts";

describe("clamp", () => {
  test("returns the value unchanged when within range", () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
  });

  test("returns min when value is below range", () => {
    assert.strictEqual(clamp(-5, 0, 10), 0);
  });

  test("returns max when value is above range", () => {
    assert.strictEqual(clamp(15, 0, 10), 10);
  });

  test("is inclusive of the min bound", () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
  });

  test("is inclusive of the max bound", () => {
    assert.strictEqual(clamp(10, 0, 10), 10);
  });

  test("works with negative ranges", () => {
    assert.strictEqual(clamp(-20, -10, -1), -10);
  });
});

describe("clampRectSize", () => {
  test("leaves a rect unchanged when it already fits", () => {
    const rect = { x: 2, y: 3, width: 4, height: 5 };
    assert.deepStrictEqual(clampRectSize(rect, { x: 10, y: 10 }), rect);
  });

  test("shrinks width/height to fit within size", () => {
    const rect = { x: 0, y: 0, width: 20, height: 30 };
    assert.deepStrictEqual(
      clampRectSize(rect, { x: 10, y: 10 }),
      { x: 0, y: 0, width: 10, height: 10 }
    );
  });

  test("clamps position once size is shrunk so the rect stays in bounds", () => {
    const rect = { x: 8, y: 8, width: 20, height: 20 };
    assert.deepStrictEqual(
      clampRectSize(rect, { x: 10, y: 10 }),
      { x: 0, y: 0, width: 10, height: 10 }
    );
  });

  test("never produces a width/height below 1", () => {
    const rect = { x: 0, y: 0, width: -5, height: 0 };
    assert.deepStrictEqual(
      clampRectSize(rect, { x: 10, y: 10 }),
      { x: 0, y: 0, width: 1, height: 1 }
    );
  });
});

describe("clampRectPosition", () => {
  test("leaves a rect unchanged when it already fits", () => {
    const rect = { x: 2, y: 3, width: 4, height: 5 };
    assert.deepStrictEqual(clampRectPosition(rect, { x: 10, y: 10 }), rect);
  });

  test("clamps position to keep the rect within bounds without resizing it", () => {
    const rect = { x: 8, y: 9, width: 5, height: 5 };
    assert.deepStrictEqual(
      clampRectPosition(rect, { x: 10, y: 10 }),
      { x: 5, y: 5, width: 5, height: 5 }
    );
  });

  test("clamps negative position to 0", () => {
    const rect = { x: -5, y: -5, width: 4, height: 4 };
    assert.deepStrictEqual(
      clampRectPosition(rect, { x: 10, y: 10 }),
      { x: 0, y: 0, width: 4, height: 4 }
    );
  });
});

describe("pointInRect", () => {
  const rect = { x: 2, y: 3, width: 4, height: 5 };

  test("returns true for a point inside the rect", () => {
    assert.strictEqual(pointInRect({ x: 3, y: 4 }, rect), true);
  });

  test("is inclusive of the top-left edge", () => {
    assert.strictEqual(pointInRect({ x: 2, y: 3 }, rect), true);
  });

  test("is exclusive of the bottom-right edge", () => {
    assert.strictEqual(pointInRect({ x: 6, y: 8 }, rect), false);
  });

  test("returns false for a point outside the rect", () => {
    assert.strictEqual(pointInRect({ x: 0, y: 0 }, rect), false);
  });
});
