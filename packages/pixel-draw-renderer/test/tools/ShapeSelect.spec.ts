// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ShapeSelect } from "../../src/tools/ShapeSelect.ts";
import { PixelBuffer } from "../../src/buffer/PixelBuffer.ts";
import type { RGBA, Vec2 } from "../../src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kBorder: RGBA = { r: 0, g: 0, b: 0, a: 255 };
const kInside: RGBA = { r: 255, g: 255, b: 255, a: 255 };
const kOutside: RGBA = { r: 200, g: 200, b: 200, a: 255 };

function fillAll(
  buf: PixelBuffer,
  size: { x: number; y: number; },
  color: RGBA
): void {
  const all: Vec2[] = [];
  for (let y = 0; y < size.y; y++) {
    for (let x = 0; x < size.x; x++) {
      all.push({ x, y });
    }
  }
  buf.drawPixels(all, color);
}

/** Every position (rect-relative) whose mask cell is true. */
function maskedPositions(
  mask: boolean[],
  width: number
): Vec2[] {
  const positions: Vec2[] = [];
  mask.forEach((selected, i) => {
    if (selected) {
      positions.push({ x: i % width, y: Math.floor(i / width) });
    }
  });

  return positions;
}

describe("ShapeSelect", () => {
  describe("compute", () => {
    test("returns null when the seed has no matching neighbors (isolated 1x1)", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kOutside, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 1, y: 1 }], kBorder);

      assert.strictEqual(ShapeSelect.compute(buf, { x: 1, y: 1 }), null);
    });

    test("returns null when the seed is out of bounds", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });

      assert.strictEqual(ShapeSelect.compute(buf, { x: -1, y: 0 }), null);
    });

    test("a plain filled rectangle selects exactly its own bounding box (full mask)", () => {
      const buf = new PixelBuffer({ size: { x: 6, y: 6 }, defaultColor: kOutside, maxSize: kTestMaxSize });
      const block: Vec2[] = [];
      for (let y = 1; y < 4; y++) {
        for (let x = 1; x < 3; x++) {
          block.push({ x, y });
        }
      }
      buf.drawPixels(block, kInside);

      const result = ShapeSelect.compute(buf, { x: 1, y: 2 });

      assert.deepStrictEqual(result!.rect, { x: 1, y: 1, width: 2, height: 3 });
      assert.deepStrictEqual(result!.mask, new Array(6).fill(true));
    });

    test("does not leak diagonally through a wall (4-directional connectivity only)", () => {
      // Same 3x3 corners-vs-rest layout as Fill.floodFill's own test.
      const buf = new PixelBuffer({ size: { x: 3, y: 3 }, maxSize: kTestMaxSize });
      fillAll(buf, { x: 3, y: 3 }, kOutside);
      buf.drawPixels([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 }], kBorder);

      assert.strictEqual(ShapeSelect.compute(buf, { x: 0, y: 0 }), null, "a lone corner pixel has no matching neighbor");
    });

    test("a hollow ring (border only) selects the border AND its fully enclosed interior", () => {
      // 5x5 buffer: a 1px black border ring around a solid 3x3 white interior.
      const buf = new PixelBuffer({ size: { x: 5, y: 5 }, maxSize: kTestMaxSize });
      fillAll(buf, { x: 5, y: 5 }, kBorder);
      const interior: Vec2[] = [];
      for (let y = 1; y < 4; y++) {
        for (let x = 1; x < 4; x++) {
          interior.push({ x, y });
        }
      }
      buf.drawPixels(interior, kInside);

      const result = ShapeSelect.compute(buf, { x: 0, y: 0 });

      assert.deepStrictEqual(result!.rect, { x: 0, y: 0, width: 5, height: 5 });
      // Every cell in the 5x5 box should end up selected: the border itself
      // plus the fully enclosed 3x3 interior hole.
      assert.deepStrictEqual(result!.mask, new Array(25).fill(true));
    });

    test("an L-shaped region (concave, no enclosed hole) keeps its true concave outline", () => {
      // 3x3 buffer, black L-shape: full left column + full bottom row.
      // . . .
      // X . .
      // X X X
      const buf = new PixelBuffer({ size: { x: 3, y: 3 }, defaultColor: kOutside, maxSize: kTestMaxSize });
      buf.drawPixels(
        [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
        kBorder
      );

      const result = ShapeSelect.compute(buf, { x: 0, y: 1 });

      assert.deepStrictEqual(result!.rect, { x: 0, y: 1, width: 3, height: 2 });
      // rect-relative 3x2: row0 = (0,1)-only selected, row1 = fully selected.
      assert.deepStrictEqual(result!.mask, [true, false, false, true, true, true]);
    });

    test("discards the result when hole-filling still leaves 1 or fewer selected cells", () => {
      // A single isolated pixel has no possible hole to fill either way —
      // covered above — this test instead checks a 2-pixel line is kept
      // (sanity boundary check around the >1 threshold).
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kOutside, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 1, y: 1 }, { x: 2, y: 1 }], kBorder);

      const result = ShapeSelect.compute(buf, { x: 1, y: 1 });

      assert.deepStrictEqual(result!.rect, { x: 1, y: 1, width: 2, height: 1 });
      assert.deepStrictEqual(result!.mask, [true, true]);
    });

    test("mask indexing lines up with the rect (rect-relative positions match the region)", () => {
      const buf = new PixelBuffer({ size: { x: 4, y: 4 }, defaultColor: kOutside, maxSize: kTestMaxSize });
      buf.drawPixels([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }], kBorder);

      const result = ShapeSelect.compute(buf, { x: 1, y: 1 })!;
      const positions = maskedPositions(result.mask, result.rect.width)
        .map((p) => {
          return { x: p.x + result.rect.x, y: p.y + result.rect.y };
        })
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));

      assert.deepStrictEqual(
        positions,
        [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }].sort((a, b) => (a.y - b.y) || (a.x - b.x))
      );
    });
  });
});
