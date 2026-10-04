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
  describe("constructor", () => {
    test("canvas returns a canvas with correct dimensions", () => {
      const buf = new CanvasBuffer({
        size: { x: 16, y: 16 },
        maxSize: TEST_MAX_SIZE
      });
      const canvas = buf.canvas();
      assert.strictEqual(canvas.width, 16);
      assert.strictEqual(canvas.height, 16);
    });

    test("exposes the validated maximum size", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });

      assert.strictEqual(buf.maxSize, TEST_MAX_SIZE);
    });
  });

  describe("drawPixels / samplePixel", () => {
    test("syncs the working canvas with a single putImageData call regardless of pixel count", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      const ctx = mockContextOf(buf.canvas());
      const before = ctx.putImageDataCallCount;

      const pixels = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 1 },
        { x: 3, y: 2 },
        { x: 4, y: 3 }
      ];
      buf.drawPixels(
        pixels,
        { r: 10, g: 20, b: 30, a: 255 }
      );

      assert.strictEqual(ctx.putImageDataCallCount - before, 1);
    });

    test(
      "leaves pixels inside the bounding box but outside the drawn set untouched on the canvas mirror",
      () => {
        const buf = new CanvasBuffer({
          size: { x: 8, y: 8 },
          maxSize: TEST_MAX_SIZE
        });
        buf.drawPixels(
          [
            { x: 2, y: 2 }
          ],
          { r: 1, g: 2, b: 3, a: 4 }
        );

        buf.drawPixels(
          [
            { x: 0, y: 0 },
            { x: 4, y: 4 }
          ],
          { r: 100, g: 100, b: 100, a: 255 }
        );

        const mirror = mockContextOf(buf.canvas()).pixels;
        assert.deepStrictEqual(
          readPixel(mirror, { x: 2, y: 2 }, 8),
          [1, 2, 3, 4]
        );
        assert.deepStrictEqual(
          readPixel(mirror, { x: 0, y: 0 }, 8),
          [100, 100, 100, 255]
        );
        assert.deepStrictEqual(
          readPixel(mirror, { x: 4, y: 4 }, 8),
          [100, 100, 100, 255]
        );
      }
    );

    test("accepts a lazy iterable (generator), not just an array", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      function* positions() {
        yield { x: 1, y: 1 };
        yield { x: 2, y: 2 };
      }

      buf.drawPixels(
        positions(),
        { r: 10, g: 20, b: 30, a: 255 }
      );

      const mirror = mockContextOf(buf.canvas()).pixels;
      assert.deepStrictEqual(
        readPixel(mirror, { x: 1, y: 1 }, 4),
        [10, 20, 30, 255]
      );
      assert.deepStrictEqual(
        readPixel(mirror, { x: 2, y: 2 }, 4),
        [10, 20, 30, 255]
      );
    });

    test("skips the canvas sync entirely when every position is out of bounds", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const ctx = mockContextOf(buf.canvas());
      const before = ctx.putImageDataCallCount;

      assert.doesNotThrow(() => buf.drawPixels(
        [
          { x: -1, y: -1 },
          { x: 99, y: 99 }
        ],
        { r: 1, g: 1, b: 1, a: 1 }
      ));

      assert.strictEqual(ctx.putImageDataCallCount, before);
    });
  });

  describe("pixels", () => {
    test("returns a copy that does not alias the buffer", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: TEST_MAX_SIZE
      });
      const pixels = buf.pixels();
      pixels.set([9, 9, 9, 9], 0);

      assert.strictEqual(pixels.length, 4 * 4 * 4);
      assert.deepStrictEqual(buf.samplePixel(0, 0), [1, 2, 3, 255]);
    });
  });
});
