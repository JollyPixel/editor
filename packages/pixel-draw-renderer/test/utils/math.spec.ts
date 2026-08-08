// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  clamp,
  clipRectToBounds,
  clampRectPosition,
  clampRectSize,
  isVec2,
  pointInRect,
  vec2Equal
} from "#src/utils/math.ts";

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
    assert.deepStrictEqual(
      clampRectSize(rect, { x: 10, y: 10 }),
      rect
    );
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
    assert.deepStrictEqual(
      clampRectPosition(rect, { x: 10, y: 10 }),
      rect
    );
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

describe("clipRectToBounds", () => {
  test("leaves a rectangle unchanged when it is already inside", () => {
    assert.deepStrictEqual(
      clipRectToBounds(
        { x: 2, y: 3, width: 4, height: 5 },
        { x: 10, y: 10 }
      ),
      { x: 2, y: 3, width: 4, height: 5 }
    );
  });

  test("clips every side to the bounds", () => {
    assert.deepStrictEqual(
      clipRectToBounds(
        { x: -2, y: -3, width: 15, height: 16 },
        { x: 10, y: 10 }
      ),
      { x: 0, y: 0, width: 10, height: 10 }
    );
  });

  test("preserves only the intersecting portion", () => {
    assert.deepStrictEqual(
      clipRectToBounds(
        { x: -3, y: 2, width: 5, height: 4 },
        { x: 10, y: 10 }
      ),
      { x: 0, y: 2, width: 2, height: 4 }
    );
  });

  test("returns null when the rectangle is entirely outside", () => {
    assert.strictEqual(
      clipRectToBounds(
        { x: -4, y: 2, width: 3, height: 4 },
        { x: 10, y: 10 }
      ),
      null
    );
  });
});

describe("pointInRect", () => {
  const rect = {
    x: 2,
    y: 3,
    width: 4,
    height: 5
  };

  test("returns true for a point inside the rect", () => {
    assert.ok(pointInRect({ x: 3, y: 4 }, rect));
  });

  test("is inclusive of the top-left edge", () => {
    assert.ok(pointInRect({ x: 2, y: 3 }, rect));
  });

  test("is exclusive of the bottom-right edge", () => {
    assert.ok(!pointInRect({ x: 6, y: 8 }, rect));
  });

  test("returns false for a point outside the rect", () => {
    assert.ok(!pointInRect({ x: 0, y: 0 }, rect));
  });
});

describe("isVec2", () => {
  test("returns true for a plain {x, y} object of numbers", () => {
    assert.ok(isVec2({ x: 1, y: 2 }));
  });

  test("returns false for null", () => {
    assert.ok(!isVec2(null));
  });

  test("returns false for a non-object", () => {
    assert.ok(!isVec2("not a vec2"));
    assert.ok(!isVec2(42));
    assert.ok(!isVec2(undefined));
  });

  test("returns false when x or y is missing", () => {
    assert.ok(!isVec2({ x: 1 }));
    assert.ok(!isVec2({ y: 2 }));
    assert.ok(!isVec2({}));
  });

  test("returns false when x or y is not a number", () => {
    assert.ok(!isVec2({ x: "1", y: 2 }));
    assert.ok(!isVec2({ x: 1, y: "2" }));
  });
});

describe("vec2Equal", () => {
  test("returns true for two points with the same coordinates", () => {
    assert.ok(vec2Equal({ x: 1, y: 2 }, { x: 1, y: 2 }));
  });

  test("returns false for two points with different coordinates", () => {
    assert.ok(!vec2Equal({ x: 1, y: 2 }, { x: 1, y: 3 }));
  });

  test("returns true when both are null", () => {
    assert.ok(vec2Equal(null, null));
  });

  test("returns false when only one side is null", () => {
    assert.ok(!vec2Equal(null, { x: 0, y: 0 }));
    assert.ok(!vec2Equal({ x: 0, y: 0 }, null));
  });
});
