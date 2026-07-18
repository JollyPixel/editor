// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Line } from "../../src/tools/Line.ts";

describe("Line", () => {
  describe("rasterize", () => {
    test("horizontal line", () => {
      const points = Line.rasterize({ x: 0, y: 0 }, { x: 3, y: 0 });
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }
      ]);
    });

    test("vertical line", () => {
      const points = Line.rasterize({ x: 0, y: 0 }, { x: 0, y: 3 });
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }
      ]);
    });

    test("45 degree diagonal", () => {
      const points = Line.rasterize({ x: 0, y: 0 }, { x: 3, y: 3 });
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }
      ]);
    });

    test("arbitrary slope stays contiguous (no diagonal gaps)", () => {
      const points = Line.rasterize({ x: 0, y: 0 }, { x: 5, y: 2 });
      for (let i = 1; i < points.length; i++) {
        const dx = Math.abs(points[i].x - points[i - 1].x);
        const dy = Math.abs(points[i].y - points[i - 1].y);
        assert.ok(dx <= 1 && dy <= 1, `step ${i} should move by at most 1px per axis`);
      }
      assert.deepStrictEqual(points[0], { x: 0, y: 0 });
      assert.deepStrictEqual(points.at(-1), { x: 5, y: 2 });
    });

    test("works in all directions (negative deltas)", () => {
      const points = Line.rasterize({ x: 5, y: 5 }, { x: 2, y: 8 });
      assert.deepStrictEqual(points[0], { x: 5, y: 5 });
      assert.deepStrictEqual(points.at(-1), { x: 2, y: 8 });
    });

    test("zero-length segment rasterizes to a single point", () => {
      const points = Line.rasterize({ x: 4, y: 4 }, { x: 4, y: 4 });
      assert.deepStrictEqual(points, [{ x: 4, y: 4 }]);
    });
  });

  describe("armed-state machine", () => {
    test("starts unarmed", () => {
      const tool = new Line();
      assert.strictEqual(tool.isArmed, false);
      assert.strictEqual(tool.previewPoints, null);
    });

    test("arm() sets armed state with start === end", () => {
      const tool = new Line();
      tool.arm({ x: 1, y: 1 });
      assert.strictEqual(tool.isArmed, true);
      assert.deepStrictEqual(tool.previewPoints, [{ x: 1, y: 1 }]);
    });

    test("arm() defaults commitTrigger to 'mousedown'", () => {
      const tool = new Line();
      tool.arm({ x: 0, y: 0 });
      assert.strictEqual(tool.commitTrigger, "mousedown");
    });

    test("arm() accepts an explicit commitTrigger", () => {
      const tool = new Line();
      tool.arm({ x: 0, y: 0 }, "mouseup");
      assert.strictEqual(tool.commitTrigger, "mouseup");
    });

    test("update() moves the end position while armed", () => {
      const tool = new Line();
      tool.arm({ x: 0, y: 0 });
      tool.update({ x: 2, y: 0 });
      assert.deepStrictEqual(tool.previewPoints, [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }
      ]);
    });

    test("update() is a no-op while unarmed", () => {
      const tool = new Line();
      tool.update({ x: 9, y: 9 });
      assert.strictEqual(tool.previewPoints, null);
    });

    test("cancel() disarms and clears preview", () => {
      const tool = new Line();
      tool.arm({ x: 0, y: 0 });
      tool.update({ x: 5, y: 0 });
      tool.cancel();
      assert.strictEqual(tool.isArmed, false);
      assert.strictEqual(tool.previewPoints, null);
    });

    test("commit() returns the rasterized points and disarms", () => {
      const tool = new Line();
      tool.arm({ x: 0, y: 0 });
      tool.update({ x: 2, y: 0 });

      const points = tool.commit();
      assert.deepStrictEqual(points, [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }
      ]);
      assert.strictEqual(tool.isArmed, false);
      assert.strictEqual(tool.previewPoints, null);
    });

    test("commit() returns null when not armed", () => {
      const tool = new Line();
      assert.strictEqual(tool.commit(), null);
    });
  });
});
