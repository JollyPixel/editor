// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { TEST_MAX_SIZE } from "../helpers/buffer/maxSize.ts";

describe("PixelBuffer", () => {
  describe("drawColorGroups", () => {
    test("writes each group's positions with its color", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });

      buf.drawColorGroups([
        {
          color: { r: 255, g: 0, b: 0, a: 255 },
          positions: [{ x: 0, y: 0 }, { x: 1, y: 0 }]
        },
        {
          color: { r: 0, g: 0, b: 255, a: 255 },
          positions: [{ x: 3, y: 3 }]
        }
      ]);

      assert.deepStrictEqual(buf.samplePixel(0, 0), [255, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(1, 0), [255, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(3, 3), [0, 0, 255, 255]);
      assert.deepStrictEqual(buf.samplePixel(2, 2), [255, 255, 255, 255]);
    });
  });

  describe("drawMaskedRegion", () => {
    test("writes only masked-true cells, leaving masked-false cells untouched", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 2, y: 1 }
      ], { r: 1, g: 2, b: 3, a: 4 });

      const red = { r: 255, g: 0, b: 0, a: 255 };
      const blue = { r: 0, g: 0, b: 255, a: 255 };
      buf.drawMaskedRegion(
        { x: 1, y: 1, width: 2, height: 1 },
        [red, blue],
        [true, false]
      );

      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(2, 1),
        [1, 2, 3, 4],
        "masked-false cell untouched"
      );
    });

    test("ignores positions outside the buffer bounds", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const color = { r: 9, g: 9, b: 9, a: 255 };

      buf.drawMaskedRegion(
        {
          x: 2, y: 2, width: 4, height: 4
        },
        Array.from({ length: 16 }, () => color),
        Array.from({ length: 16 }, () => true)
      );

      assert.deepStrictEqual(buf.samplePixel(3, 3), [9, 9, 9, 255]);
      assert.deepStrictEqual(buf.samplePixel(0, 3), [255, 255, 255, 255]);
      assert.deepStrictEqual(buf.samplePixel(1, 3), [255, 255, 255, 255]);
    });

    test("preserves mask alignment when clipping the top and left edges", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        defaultColor: { r: 20, g: 0, b: 0, a: 255 },
        maxSize: TEST_MAX_SIZE
      });
      const pixels = Array.from({ length: 9 }, (_, index) => {
        return {
          r: index,
          g: 0,
          b: 0,
          a: 255
        };
      });
      const mask = Array.from({ length: 9 }, () => false);
      mask[4] = true;
      mask[8] = true;

      buf.drawMaskedRegion(
        { x: -1, y: -1, width: 3, height: 3 },
        pixels,
        mask
      );

      assert.deepStrictEqual(buf.samplePixel(0, 0), [4, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(1, 0), [20, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(0, 1), [20, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(1, 1), [8, 0, 0, 255]);
    });
  });

  describe("hasTransparency", () => {
    test("returns false when every pixel in rect is fully opaque", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });

      assert.strictEqual(
        buf.hasTransparency({ x: 1, y: 1, width: 2, height: 2 }),
        false
      );
    });

    test("returns true when a pixel in rect is fully transparent", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([{ x: 2, y: 2 }], { r: 0, g: 0, b: 0, a: 0 });

      assert.strictEqual(
        buf.hasTransparency({ x: 1, y: 1, width: 2, height: 2 }),
        true
      );
    });

    test("returns true when a pixel in rect is only partially transparent", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([{ x: 2, y: 2 }], { r: 1, g: 2, b: 3, a: 254 });

      assert.strictEqual(
        buf.hasTransparency({ x: 1, y: 1, width: 2, height: 2 }),
        true
      );
    });

    test("ignores a non-opaque pixel outside rect", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([{ x: 0, y: 0 }], { r: 0, g: 0, b: 0, a: 0 });

      assert.strictEqual(
        buf.hasTransparency({ x: 1, y: 1, width: 2, height: 2 }),
        false
      );
    });

    test("treats a rect extending past the buffer edge as transparent", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });

      assert.strictEqual(
        buf.hasTransparency({ x: 2, y: 2, width: 4, height: 4 }),
        true
      );
    });
  });
});
