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
const kBlue: RGBA8 = { r: 0, g: 0, b: 255, a: 255 };
const kWhite: RGBA8 = { r: 255, g: 255, b: 255, a: 255 };
const kTransparent: RGBA8 = { r: 0, g: 0, b: 0, a: 0 };

describe("Select — static helpers", () => {
  describe("captureSnapshot (static)", () => {
    test("reads pixels in row-major order", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([{ x: 2, y: 1 }], kRed);
      buf.drawPixels([{ x: 1, y: 2 }], kBlue);

      const pixels = Select.captureSnapshot(
        buf,
        { x: 1, y: 1, width: 2, height: 2 }
      );

      assert.deepStrictEqual(
        pixels,
        [kWhite, kRed, kBlue, kWhite]
      );
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

      assert.deepStrictEqual(pixels[1], kTransparent);
      assert.deepStrictEqual(pixels[2], kTransparent);
      assert.deepStrictEqual(pixels[3], kTransparent);
    });
  });

  describe("dominantBorderColor (static)", () => {
    test("picks the most frequent color among the surrounding ring, ignoring the rect's own interior", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 2, y: 3 },
        { x: 3, y: 3 }
      ], kRed);
      buf.drawPixels([
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 1, y: 4 },
        { x: 2, y: 4 },
        { x: 3, y: 4 }
      ], kBlue);

      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 2, y: 2, width: 2, height: 2 }
        ),
        kBlue
      );
    });

    test("is transparent when the rect has no in-bounds neighbors (it spans the whole texture)", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 0, y: 0, width: 4, height: 4 }
        ),
        kTransparent
      );
    });

    test("samples clipped neighbors correctly when the rect touches the texture edge", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        Select.dominantBorderColor(
          buf,
          { x: 0, y: 0, width: 2, height: 2 }
        ),
        kWhite
      );
    });
  });

  describe("rotateRectCW (static)", () => {
    test("on a square rect keeps the same footprint", () => {
      assert.deepStrictEqual(
        Select.rotateRectCW({
          x: 3, y: 4, width: 5, height: 5
        }),
        { x: 3, y: 4, width: 5, height: 5 }
      );
    });
  });
});
