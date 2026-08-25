// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Select } from "#src/tools/Select.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { RGBA8 } from "#src/types.ts";

// CONSTANTS
const kTestMaxSize = 32;
const kRed: RGBA8 = { r: 255, g: 0, b: 0, a: 255 };
const kColorA: RGBA8 = { r: 10, g: 0, b: 0, a: 255 };
const kColorB: RGBA8 = { r: 20, g: 0, b: 0, a: 255 };
const kColorC: RGBA8 = { r: 30, g: 0, b: 0, a: 255 };
const kColorD: RGBA8 = { r: 40, g: 0, b: 0, a: 255 };
const kColorE: RGBA8 = { r: 50, g: 0, b: 0, a: 255 };
const kColorF: RGBA8 = { r: 60, g: 0, b: 0, a: 255 };
// 2 wide x 3 tall, row-major:
// A B
// C D
// E F
const k2x3Snapshot: RGBA8[] = [
  kColorA,
  kColorB,
  kColorC,
  kColorD,
  kColorE,
  kColorF
];

describe("Select — static helpers", () => {
  describe("normalizeRect (static)", () => {
    test("a === b yields a 1x1 rect", () => {
      assert.deepStrictEqual(
        Select.normalizeRect({ x: 3, y: 3 }, { x: 3, y: 3 }),
        { x: 3, y: 3, width: 1, height: 1 }
      );
    });

    test("normalizes regardless of drag direction", () => {
      assert.deepStrictEqual(
        Select.normalizeRect({ x: 5, y: 5 }, { x: 2, y: 1 }),
        { x: 2, y: 1, width: 4, height: 5 }
      );
      assert.deepStrictEqual(
        Select.normalizeRect({ x: 2, y: 1 }, { x: 5, y: 5 }),
        { x: 2, y: 1, width: 4, height: 5 }
      );
    });
  });

  describe("captureSnapshot (static)", () => {
    test("reads pixels in row-major order", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([{ x: 1, y: 1 }], kRed);

      const pixels = Select.captureSnapshot(
        buf,
        { x: 1, y: 1, width: 2, height: 1 }
      );

      assert.deepStrictEqual(pixels[0], kRed);
      assert.notDeepStrictEqual(pixels[1], kRed);
    });

    test("out-of-bounds positions sample as fully transparent", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        maxSize: kTestMaxSize
      });

      const pixels = Select.captureSnapshot(
        buf,
        { x: 1, y: 1, width: 2, height: 2 }
      );

      // (2,1), (1,2), (2,2) are out of bounds; only (1,1) is real.
      assert.deepStrictEqual(
        pixels[1],
        { r: 0, g: 0, b: 0, a: 0 }
      );
      assert.deepStrictEqual(
        pixels[2],
        { r: 0, g: 0, b: 0, a: 0 }
      );
      assert.deepStrictEqual(
        pixels[3],
        { r: 0, g: 0, b: 0, a: 0 }
      );
    });
  });

  describe("dominantBorderColor (static)", () => {
    const kFallback: RGBA8 = { r: 1, g: 2, b: 3, a: 4 };
    const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };

    test("returns the canvas's own default fill when the rect's border is untouched", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 2, y: 2, width: 2, height: 2 },
          kFallback
        ),
        kWhite
      );
    });

    test("picks the most frequent color among the surrounding ring, ignoring the rect's own interior", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      // Paint the rect's interior red — must be ignored, it's not a neighbor.
      buf.drawPixels([
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 }
      ], kRed);
      // The ring around a (2,2,2,2) rect has 12 cells; paint 7 of them blue,
      // outnumbering the 5 still at the canvas's default white.
      const blue: RGBA8 = {
        r: 0, g: 0, b: 255, a: 255
      };
      buf.drawPixels([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 3, y: 4 }
      ], blue);

      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 2, y: 2, width: 2, height: 2 },
          kFallback
        ),
        blue
      );
    });

    test("falls back when the rect has no in-bounds neighbors (it spans the whole texture)", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 0, y: 0, width: 4, height: 4 },
          kFallback
        ),
        kFallback
      );
    });

    test("samples clipped neighbors correctly when the rect touches the texture edge", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });

      // Rect at the top-left corner: only its right and bottom borders have
      // in-bounds neighbors, all still the canvas default (white).
      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 0, y: 0, width: 2, height: 2 },
          kFallback
        ),
        kWhite
      );
    });
  });

  describe("rotate/flip transforms (static)", () => {
    test("rotateRectCW swaps width/height and pivots on the rect's center (rounded)", () => {
      assert.deepStrictEqual(
        Select.rotateRectCW({
          x: 5, y: 5, width: 2, height: 3
        }),
        { x: 5, y: 6, width: 3, height: 2 }
      );
    });

    test("rotateRectCW on a square rect keeps the same footprint", () => {
      assert.deepStrictEqual(
        Select.rotateRectCW({
          x: 3, y: 4, width: 5, height: 5
        }),
        { x: 3, y: 4, width: 5, height: 5 }
      );
    });

    test("rotateSnapshotCW rotates a non-square grid 90 degrees clockwise", () => {
      // A B      E C A
      // C D  ->  F D B
      // E F
      assert.deepStrictEqual(
        Select.rotateSnapshotCW(k2x3Snapshot, 2, 3),
        [kColorE, kColorC, kColorA, kColorF, kColorD, kColorB]
      );
    });

    test("rotateSnapshotCW applied 4 times returns the original grid", () => {
      let snapshot = k2x3Snapshot;
      let width = 2;
      let height = 3;

      for (let i = 0; i < 4; i++) {
        snapshot = Select.rotateSnapshotCW(
          snapshot,
          width,
          height
        );
        [width, height] = [height, width];
      }

      assert.deepStrictEqual(snapshot, k2x3Snapshot);
      assert.strictEqual(width, 2);
      assert.strictEqual(height, 3);
    });

    test("flipSnapshotHorizontal mirrors each row left-right", () => {
      assert.deepStrictEqual(
        Select.flipSnapshotHorizontal(k2x3Snapshot, 2, 3),
        [
          kColorB,
          kColorA,
          kColorD,
          kColorC,
          kColorF,
          kColorE
        ]
      );
    });

    test("flipSnapshotVertical mirrors rows top-bottom", () => {
      assert.deepStrictEqual(
        Select.flipSnapshotVertical(k2x3Snapshot, 2, 3),
        [
          kColorE,
          kColorF,
          kColorC,
          kColorD,
          kColorA,
          kColorB
        ]
      );
    });
  });

  describe("grid transform helpers (static, generic)", () => {
    test("rotateMaskCW rotates a boolean grid the same way rotateSnapshotCW rotates an RGBA8 grid", () => {
      // Same layout as k2x3Snapshot (A..F), true where the letter is one of A/D/E.
      const mask = [true, false, false, true, true, false];
      // rotateSnapshotCW(k2x3Snapshot) === [E, C, A, F, D, B] — same permutation, as booleans.
      assert.deepStrictEqual(
        Select.rotateMaskCW(mask, 2, 3),
        [true, false, true, false, true, false]
      );
    });

    test("flipMaskHorizontal/flipMaskVertical mirror a boolean grid", () => {
      const mask = [true, false, false, true];
      assert.deepStrictEqual(
        Select.flipMaskHorizontal(mask, 2, 2),
        [false, true, true, false]
      );
      assert.deepStrictEqual(
        Select.flipMaskVertical(mask, 2, 2),
        [false, true, true, false]
      );
    });
  });
});
