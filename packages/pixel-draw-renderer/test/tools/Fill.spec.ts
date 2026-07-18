// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Fill } from "../../src/tools/Fill.ts";
import { PixelBuffer } from "../../src/buffer/PixelBuffer.ts";
import type { RGBA, Vec2 } from "../../src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kColorA: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const kColorB: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const kFillColor: RGBA = { r: 0, g: 255, b: 0, a: 255 };

function sortPositions(
  positions: Vec2[]
): Vec2[] {
  return [...positions].sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

describe("Fill", () => {
  describe("floodFill", () => {
    test("fills a uniformly colored rectangle exactly (no under/over-fill)", () => {
      const buf = new PixelBuffer({ size: { x: 6, y: 6 }, maxSize: kTestMaxSize });
      // Overwrite the whole buffer with colorA, then a colorB rectangle
      // inside it, to sidestep PixelBuffer's always-transparent (0,0) quirk.
      const all: Vec2[] = [];
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, kColorA);

      const rect: Vec2[] = [];
      for (let y = 2; y < 4; y++) {
        for (let x = 1; x < 4; x++) {
          rect.push({ x, y });
        }
      }
      buf.drawPixels(rect, kColorB);

      const positions = Fill.floodFill(buf, { x: 2, y: 3 }, kFillColor);

      assert.deepStrictEqual(sortPositions(positions), sortPositions(rect));
    });

    test("does not leak diagonally through a colorB wall (4-directional connectivity only)", () => {
      // 3x3 grid: corners are colorA, everything else (edges + center) is
      // colorB. The corners are only diagonally adjacent to each other.
      const buf = new PixelBuffer({ size: { x: 3, y: 3 }, maxSize: kTestMaxSize });
      const all: Vec2[] = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, kColorB);
      buf.drawPixels([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }], kColorA);

      const positions = Fill.floodFill(buf, { x: 0, y: 0 }, kFillColor);

      assert.deepStrictEqual(positions, [{ x: 0, y: 0 }]);
    });

    test("does not include a same-colored but disconnected region", () => {
      // Two 2x2 colorA blobs separated by a full-height colorB column.
      const buf = new PixelBuffer({ size: { x: 5, y: 2 }, maxSize: kTestMaxSize });
      const all: Vec2[] = [];
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 5; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, kColorB);
      buf.drawPixels([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }], kColorA);
      buf.drawPixels([{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }, { x: 4, y: 1 }], kColorA);

      const positions = Fill.floodFill(buf, { x: 0, y: 0 }, kFillColor);

      assert.deepStrictEqual(
        sortPositions(positions),
        sortPositions([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }])
      );
    });

    test("returns [] when the seed already matches fillColor (no-op)", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kColorA, maxSize: kTestMaxSize });

      const positions = Fill.floodFill(buf, { x: 1, y: 1 }, kColorA);

      assert.deepStrictEqual(positions, []);
    });

    test("returns [] when the seed is out of bounds", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });

      assert.deepStrictEqual(Fill.floodFill(buf, { x: -1, y: 0 }, kFillColor), []);
      assert.deepStrictEqual(Fill.floodFill(buf, { x: 0, y: 4 }, kFillColor), []);
    });

    test("returns each position exactly once", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kColorA, maxSize: kTestMaxSize });

      const positions = Fill.floodFill(buf, { x: 1, y: 1 }, kFillColor);
      const keys = positions.map((p) => `${p.x},${p.y}`);

      assert.strictEqual(keys.length, new Set(keys).size);
    });

    test("excludes pixel (0,0) when it differs from the flood-filled region (PixelBuffer's always-transparent origin)", () => {
      const buf = new PixelBuffer({ size: { x: 3, y: 3 }, defaultColor: kColorA, maxSize: kTestMaxSize });

      const positions = Fill.floodFill(buf, { x: 1, y: 1 }, kFillColor);

      assert.strictEqual(positions.some((p) => p.x === 0 && p.y === 0), false);
      assert.strictEqual(positions.length, 8, "all pixels except the transparent origin");
    });
  });

  describe("matchAll", () => {
    test("matches every pixel of the given color, including disconnected regions", () => {
      // Two 2x2 colorA blobs separated by a full-height colorB column —
      // matchAll (unlike floodFill) should return both, connectivity aside.
      const buf = new PixelBuffer({ size: { x: 5, y: 2 }, maxSize: kTestMaxSize });
      const all: Vec2[] = [];
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 5; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, kColorB);
      buf.drawPixels([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }], kColorA);
      buf.drawPixels([{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }, { x: 4, y: 1 }], kColorA);

      const positions = Fill.matchAll(buf, kColorA);

      assert.deepStrictEqual(
        sortPositions(positions),
        sortPositions([
          { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
          { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 0 }, { x: 4, y: 1 }
        ])
      );
    });

    test("returns [] when no pixel matches the given color", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kColorA, maxSize: kTestMaxSize });

      assert.deepStrictEqual(Fill.matchAll(buf, kColorB), []);
    });

    test("returns each position exactly once", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kColorA, maxSize: kTestMaxSize });

      const positions = Fill.matchAll(buf, kColorA);
      const keys = positions.map((p) => `${p.x},${p.y}`);

      assert.strictEqual(keys.length, new Set(keys).size);
    });

    test("scans the whole buffer, including pixel (0,0) (PixelBuffer's always-transparent origin)", () => {
      const buf = new PixelBuffer({ size: { x: 3, y: 3 }, defaultColor: kColorA, maxSize: kTestMaxSize });

      const positions = Fill.matchAll(buf, { ...kColorA, a: 0 });

      assert.deepStrictEqual(positions, [{ x: 0, y: 0 }]);
    });
  });
});
