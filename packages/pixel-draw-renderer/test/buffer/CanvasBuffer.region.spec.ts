// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CanvasBuffer } from "#src/buffer/CanvasBuffer.ts";
import {
  mockContextOf,
  readPixel
} from "../fixtures/canvas.ts";
import { TEST_MAX_SIZE } from "../helpers/buffer/maxSize.ts";

describe("CanvasBuffer", () => {
  describe("drawMaskedRegion with a full mask", () => {
    test("clips to the in-bounds intersection when the rect extends past the buffer edge", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });
      const color = { r: 9, g: 9, b: 9, a: 255 };

      buf.drawMaskedRegion(
        {
          x: 2,
          y: 2,
          width: 4,
          height: 4
        },
        Array.from({ length: 16 }, () => color),
        Array.from({ length: 16 }, () => true)
      );

      const mirror = mockContextOf(buf.canvas()).pixels;
      assert.deepStrictEqual(readPixel(mirror, { x: 2, y: 2 }, 4), [9, 9, 9, 255]);
      assert.deepStrictEqual(readPixel(mirror, { x: 3, y: 3 }, 4), [9, 9, 9, 255]);
      assert.deepStrictEqual(readPixel(mirror, { x: 0, y: 3 }, 4), [1, 2, 3, 255]);
      assert.deepStrictEqual(readPixel(mirror, { x: 1, y: 3 }, 4), [1, 2, 3, 255]);
    });

    test("syncs clipped top-left rows with their original source alignment", () => {
      const buf = new CanvasBuffer({
        size: { x: 2, y: 2 },
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

      buf.drawMaskedRegion(
        { x: -1, y: -1, width: 3, height: 3 },
        pixels,
        Array.from({ length: 9 }, () => true)
      );

      const canvasPixels = mockContextOf(buf.canvas()).pixels;
      assert.deepStrictEqual(
        readPixel(canvasPixels, { x: 0, y: 0 }, 2),
        [4, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels, { x: 1, y: 1 }, 2),
        [8, 0, 0, 255]
      );
    });
  });

  describe("drawMaskedRegion", () => {
    test("writes only masked-true cells to both the buffer and its canvas mirror", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels(
        [
          { x: 1, y: 0 }
        ],
        { r: 1, g: 2, b: 3, a: 4 }
      );

      const red = { r: 255, g: 0, b: 0, a: 255 };
      const blue = { r: 0, g: 0, b: 255, a: 255 };
      buf.drawMaskedRegion(
        {
          x: 0,
          y: 0,
          width: 2,
          height: 1
        },
        [red, blue],
        [true, false]
      );

      const mirror = mockContextOf(buf.canvas()).pixels;
      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [1, 2, 3, 4],
        "masked-false cell untouched"
      );
      assert.deepStrictEqual(
        readPixel(mirror, { x: 0, y: 0 }, 4),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(mirror, { x: 1, y: 0 }, 4),
        [1, 2, 3, 4],
        "masked-false cell untouched on the mirror"
      );
    });
  });

  describe("region writes outside the buffer", () => {
    test("drawMaskedRegion skips the canvas sync when the rect is entirely out of bounds", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const ctx = mockContextOf(buf.canvas());
      const before = ctx.putImageDataCallCount;

      buf.drawMaskedRegion(
        { x: 10, y: 10, width: 2, height: 2 },
        Array.from({ length: 4 }, () => {
          return { r: 1, g: 1, b: 1, a: 1 };
        }),
        Array.from({ length: 4 }, () => true)
      );

      assert.strictEqual(ctx.putImageDataCallCount, before);
    });
  });
});
