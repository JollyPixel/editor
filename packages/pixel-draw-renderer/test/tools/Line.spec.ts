// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Line } from "#src/tools/Line.ts";

describe("Line", () => {
  describe("rasterize", () => {
    test("horizontal line", () => {
      const points = Line.rasterize(
        { x: 0, y: 0 },
        { x: 3, y: 0 }
      );
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 }
      ]);
    });

    test("vertical line", () => {
      const points = Line.rasterize(
        { x: 0, y: 0 },
        { x: 0, y: 3 }
      );
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 }
      ]);
    });

    test("45 degree diagonal", () => {
      const points = Line.rasterize(
        { x: 0, y: 0 },
        { x: 3, y: 3 }
      );
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 }
      ]);
    });

    test("arbitrary slope stays contiguous (no diagonal gaps)", () => {
      const points = Line.rasterize(
        { x: 0, y: 0 },
        { x: 5, y: 2 }
      );
      for (let i = 1; i < points.length; i++) {
        const dx = Math.abs(points[i].x - points[i - 1].x);
        const dy = Math.abs(points[i].y - points[i - 1].y);
        assert.ok(dx <= 1 && dy <= 1, `step ${i} should move by at most 1px per axis`);
      }
      assert.deepStrictEqual(points[0], { x: 0, y: 0 });
      assert.deepStrictEqual(points.at(-1), { x: 5, y: 2 });
    });

    test("45 degree diagonal toward negative x", () => {
      const points = Line.rasterize(
        { x: 5, y: 5 },
        { x: 2, y: 8 }
      );
      assert.deepStrictEqual(points, [
        { x: 5, y: 5 },
        { x: 4, y: 6 },
        { x: 3, y: 7 },
        { x: 2, y: 8 }
      ]);
    });
  });
});
