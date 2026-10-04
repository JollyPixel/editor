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
  describe("constructor", () => {
    test("size returns the initial size", () => {
      const buf = new PixelBuffer({
        size: { x: 16, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      assert.deepStrictEqual(buf.size(), { x: 16, y: 8 });
    });

    test("fills the working buffer with defaultColor", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 10, g: 20, b: 30, a: 255 },
        maxSize: TEST_MAX_SIZE
      });

      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [10, 20, 30, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [10, 20, 30, 255]
      );
    });

    test("defaults to opaque white", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        maxSize: TEST_MAX_SIZE
      });
      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [255, 255, 255, 255]
      );
    });

    test("accepts defaultColor as a hex string", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        defaultColor: "#ff000080",
        maxSize: TEST_MAX_SIZE
      });

      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [255, 0, 0, 128]
      );
    });

    test("rejects invalid maxSize and dimensions", () => {
      assert.throws(
        () => new PixelBuffer({
          size: { x: 1, y: 1 },
          maxSize: 0
        }),
        RangeError
      );
      assert.throws(
        () => new PixelBuffer({
          size: { x: 33, y: 1 },
          maxSize: TEST_MAX_SIZE
        }),
        RangeError
      );
      assert.throws(
        () => new PixelBuffer({
          size: { x: 1.5, y: 1 },
          maxSize: TEST_MAX_SIZE
        }),
        RangeError
      );
    });
  });

  describe("drawPixels / samplePixel", () => {
    test("writes RGBA8 values to specified pixels", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 1, y: 1 }
      ], { r: 255, g: 0, b: 0, a: 255 });
      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [255, 0, 0, 255]
      );
    });

    test("ignores invalid pixel positions instead of wrapping them into the next row", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: -1, y: 1 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0.5, y: 0 }
      ], { r: 1, g: 2, b: 3, a: 4 });

      assert.deepStrictEqual(
        buf.samplePixel(0, 1),
        [255, 255, 255, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(3, 0),
        [255, 255, 255, 255]
      );
    });

    test("samplePixels reads in-bounds colors and out-of-bounds positions as transparent", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels([
        { x: 1, y: 1 }
      ], { r: 255, g: 0, b: 0, a: 255 });

      assert.deepStrictEqual(
        buf.samplePixels([{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 4, y: 0 }]),
        [
          { r: 255, g: 0, b: 0, a: 255 },
          { r: 0, g: 0, b: 0, a: 0 },
          { r: 0, g: 0, b: 0, a: 0 }
        ]
      );
    });

    test("samples out-of-bounds positions as transparent", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        defaultColor: { r: 7, g: 8, b: 9, a: 255 },
        maxSize: TEST_MAX_SIZE
      });

      assert.deepStrictEqual(buf.samplePixel(2, 0), [0, 0, 0, 0]);
      assert.deepStrictEqual(buf.samplePixel(-1, 1), [0, 0, 0, 0]);
      assert.deepStrictEqual(buf.samplePixel(0, -1), [0, 0, 0, 0]);
      assert.deepStrictEqual(buf.samplePixel(1.5, 1), [0, 0, 0, 0]);
    });

    test("accepts a lazy iterable (generator), not just an array", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      function* positions() {
        yield { x: 1, y: 1 };
        yield { x: 2, y: 2 };
      }

      buf.drawPixels(
        positions(),
        { r: 255, g: 0, b: 0, a: 255 }
      );

      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(2, 2),
        [255, 0, 0, 255]
      );
    });
  });

  describe("pixels", () => {
    test("returns a live view sized width*height*4", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const pixels = buf.pixels();
      pixels.set([1, 2, 3, 4], 0);

      assert.strictEqual(pixels.length, 4 * 4 * 4);
      assert.deepStrictEqual(buf.samplePixel(0, 0), [1, 2, 3, 4]);
    });
  });
});
