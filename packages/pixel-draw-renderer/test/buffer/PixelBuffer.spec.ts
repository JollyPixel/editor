// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";

// CONSTANTS
const kTestMaxSize = 32;

describe("PixelBuffer", () => {
  describe("constructor", () => {
    test("size returns the initial size", () => {
      const buf = new PixelBuffer({
        size: { x: 16, y: 8 },
        maxSize: kTestMaxSize
      });
      assert.deepStrictEqual(buf.size(), { x: 16, y: 8 });
    });

    test("fills the working buffer with defaultColor, except pixel (0,0)", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 10, g: 20, b: 30, a: 255 },
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [10, 20, 30, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [10, 20, 30, 0]
      );
    });

    test("defaults to opaque white", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        maxSize: kTestMaxSize
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
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [255, 0, 0, 128]
      );
    });

    test("accepts defaultColor as a colorjs.io Color instance", () => {
      const buf = new PixelBuffer({
        size: { x: 2, y: 2 },
        defaultColor: new Color("blue"),
        maxSize: kTestMaxSize
      });

      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [0, 0, 255, 255]
      );
    });
  });

  describe("drawPixels / samplePixel", () => {
    test("writes RGBA values to specified pixels", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([
        { x: 1, y: 1 }
      ], { r: 255, g: 0, b: 0, a: 255 });
      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [255, 0, 0, 255]
      );
    });

    test("ignores out-of-bounds positions", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      assert.doesNotThrow(() => {
        buf.drawPixels([
          { x: -1, y: 0 },
          { x: 4, y: 4 }
        ], { r: 1, g: 2, b: 3, a: 4 });
      });
    });

    test("accepts a lazy iterable (generator), not just an array", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
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

  describe("resize", () => {
    test("updates size", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
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
        maxSize: kTestMaxSize
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

    test("does not preserve uncommitted data", () => {
      const buf = new PixelBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([
        { x: 2, y: 2 }
      ], { r: 10, g: 20, b: 30, a: 255 });
      buf.resize({ x: 16, y: 16 });

      assert.notDeepStrictEqual(
        buf.samplePixel(2, 2),
        [10, 20, 30, 255]
      );
    });
  });

  describe("replacePixels", () => {
    test("replaces working data and size wholesale", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
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
  });

  describe("pixels", () => {
    test("returns a live view sized width*height*4", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      assert.strictEqual(buf.pixels().length, 4 * 4 * 4);
    });
  });

  describe("copyToMaster", () => {
    test("persists working data across resize", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([
        { x: 0, y: 0 }
      ], { r: 100, g: 150, b: 200, a: 255 });
      buf.copyToMaster();
      buf.resize({ x: 4, y: 4 });
      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [100, 150, 200, 255]
      );
    });
  });

  describe("drawRegion", () => {
    test("writes per-pixel colors in row-major order", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const red = { r: 255, g: 0, b: 0, a: 255 };
      const blue = { r: 0, g: 0, b: 255, a: 255 };

      buf.drawRegion({
        x: 1, y: 1, width: 2, height: 1
      }, [red, blue]);

      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(2, 1),
        [0, 0, 255, 255]
      );
    });

    test("ignores positions outside the buffer bounds", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const color = { r: 9, g: 9, b: 9, a: 255 };

      assert.doesNotThrow(() => {
        buf.drawRegion({
          x: 2, y: 2, width: 4, height: 4
        }, new Array(16).fill(color));
      });
      assert.deepStrictEqual(buf.samplePixel(3, 3), [9, 9, 9, 255]);
    });
  });

  describe("drawMaskedRegion", () => {
    test("writes only masked-true cells, leaving masked-false cells untouched", () => {
      const buf = new PixelBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
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
        maxSize: kTestMaxSize
      });
      const color = { r: 9, g: 9, b: 9, a: 255 };

      assert.doesNotThrow(() => {
        buf.drawMaskedRegion({
          x: 2, y: 2, width: 4, height: 4
        }, new Array(16).fill(color), new Array(16).fill(true));
      });
      assert.deepStrictEqual(
        buf.samplePixel(3, 3),
        [9, 9, 9, 255]
      );
    });
  });
});
