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
  describe("resize", () => {
    test("updates size", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      buf.resize({ x: 16, y: 4 });

      assert.deepStrictEqual(
        buf.size(),
        { x: 16, y: 4 }
      );
    });

    test("preserves committed data across resize", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 2, y: 2 }
      ], { r: 10, g: 20, b: 30, a: 255 });
      buf.copyToMaster();
      buf.resize({ x: 16, y: 16 });

      assert.deepStrictEqual(
        buf.samplePixel(2, 2),
        [10, 20, 30, 255]
      );
    });

    test("initializes newly reached pixels with the constructor color", () => {
      const color = { r: 12, g: 34, b: 56, a: 78 };
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        defaultColor: color,
        maxSize: TEST_MAX_SIZE
      });

      buf.resize({ x: 6, y: 5 });

      assert.deepStrictEqual(
        buf.samplePixel(5, 4),
        [12, 34, 56, 78]
      );
    });

    test("retains committed pixels through asymmetric shrink and growth", () => {
      const buf = new PixelBuffer({
        size: { x: 6, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels(
        [{ x: 5, y: 3 }],
        { r: 12, g: 34, b: 56, a: 255 }
      );
      buf.copyToMaster();

      buf.resize({ x: 2, y: 2 });
      buf.resize({ x: 8, y: 5 });

      assert.deepStrictEqual(
        buf.samplePixel(5, 3),
        [12, 34, 56, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(7, 4),
        [255, 255, 255, 255]
      );
    });

    test("does not preserve uncommitted data", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 2, y: 2 }
      ], { r: 10, g: 20, b: 30, a: 255 });
      buf.resize({ x: 16, y: 16 });

      assert.deepStrictEqual(
        buf.samplePixel(2, 2),
        [255, 255, 255, 255]
      );
    });

    test("rejects dimensions larger than maxSize", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });

      assert.throws(
        () => buf.resize({ x: TEST_MAX_SIZE + 1, y: 8 }),
        RangeError
      );
      assert.deepStrictEqual(buf.size(), { x: 8, y: 8 });
    });
  });

  describe("replacePixels", () => {
    test("replaces working data and size wholesale", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const pixels = new Uint8ClampedArray(2 * 2 * 4).fill(0);
      pixels[0] = 9;
      pixels[3] = 255;
      buf.replacePixels(pixels, { x: 2, y: 2 });

      assert.deepStrictEqual(
        buf.size(),
        { x: 2, y: 2 }
      );
      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [9, 0, 0, 255]
      );
    });

    test("replaces master data used by later resizes", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels(
        [{ x: 3, y: 3 }],
        { r: 255, g: 0, b: 0, a: 255 }
      );
      buf.copyToMaster();

      const pixels = new Uint8ClampedArray(2 * 2 * 4);
      pixels.set([9, 8, 7, 255], 0);
      buf.replacePixels(pixels, { x: 2, y: 2 });
      buf.resize({ x: 4, y: 4 });

      assert.deepStrictEqual(buf.samplePixel(0, 0), [9, 8, 7, 255]);
      assert.deepStrictEqual(buf.samplePixel(3, 3), [0, 0, 0, 0]);
    });

    test("normalizes data length to match size", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });

      buf.replacePixels(
        new Uint8ClampedArray([1, 2, 3, 4]),
        { x: 2, y: 2 }
      );

      assert.deepStrictEqual(buf.size(), { x: 2, y: 2 });
      assert.strictEqual(buf.pixels().length, 2 * 2 * 4);
      assert.deepStrictEqual(buf.samplePixel(0, 0), [1, 2, 3, 4]);
      assert.deepStrictEqual(buf.samplePixel(1, 1), [0, 0, 0, 0]);
    });
  });
});
