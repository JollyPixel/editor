// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { Vec2 } from "#src/types.ts";
import {
  COLOR_A,
  COLOR_B,
  TEST_MAX_SIZE,
  filledBuffer,
  sortPositions
} from "../helpers/fill/buffer.ts";

describe("PixelBuffer", () => {
  describe("positionsOf", () => {
    test("matches every pixel of the given color, including disconnected regions", () => {
      const buf = new PixelBuffer({
        size: { x: 5, y: 2 },
        maxSize: TEST_MAX_SIZE
      });
      const all: Vec2[] = [];
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 5; x++) {
          all.push({ x, y });
        }
      }
      buf.drawPixels(all, COLOR_B);
      buf.drawPixels([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ], COLOR_A);
      buf.drawPixels([
        { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 4, y: 0 },
        { x: 4, y: 1 }
      ], COLOR_A);

      const positions = buf.positionsOf(COLOR_A);

      assert.deepStrictEqual(
        sortPositions(positions),
        sortPositions([
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 3, y: 0 },
          { x: 3, y: 1 },
          { x: 4, y: 0 },
          { x: 4, y: 1 }
        ])
      );
    });

    test("returns [] when no pixel matches the given color", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: COLOR_A,
        maxSize: TEST_MAX_SIZE
      });

      assert.deepStrictEqual(
        buf.positionsOf(COLOR_B),
        []
      );
    });

    test("scans the whole buffer, including pixel (0,0)", () => {
      const buf = new PixelBuffer({
        size: { x: 3, y: 3 },
        defaultColor: COLOR_A,
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 0, y: 0 }
      ], { ...COLOR_A, a: 0 });

      const positions = buf.positionsOf({ ...COLOR_A, a: 0 });

      assert.deepStrictEqual(
        positions,
        [{ x: 0, y: 0 }]
      );
    });
  });
  describe("positionsOf with a mask", () => {
    test("skips matching pixels whose mask entry is zero", () => {
      const buf = filledBuffer({ x: 3, y: 2 }, COLOR_B);
      const mask = Uint8Array.from([0, 1, 0, 1, 0, 1]);

      assert.deepStrictEqual(
        buf.positionsOf(COLOR_B, mask),
        [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 1 }]
      );
    });
  });
});
