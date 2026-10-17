// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CanvasBuffer } from "#src/buffer/CanvasBuffer.ts";
import type { Vec2 } from "#src/types.ts";
import {
  canvasPixels,
  context2d,
  decodedImage,
  readPixel
} from "../fixtures/canvas.ts";
import { TEST_MAX_SIZE } from "../helpers/buffer/maxSize.ts";

describe("CanvasBuffer", () => {
  describe("resize", () => {
    test("updates working canvas dimensions", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      buf.resize({ x: 20, y: 10 });
      const canvas = buf.canvas();
      assert.strictEqual(canvas.width, 20);
      assert.strictEqual(canvas.height, 10);
    });

    test("copies master data into new working canvas", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: TEST_MAX_SIZE
      });
      buf.drawPixels(
        [
          { x: 2, y: 2 }
        ],
        { r: 10, g: 20, b: 30, a: 255 }
      );
      buf.copyToMaster();
      buf.resize({ x: 16, y: 16 });

      const mirror = canvasPixels(buf.canvas());
      assert.deepStrictEqual(
        readPixel(mirror, { x: 2, y: 2 }, 16),
        [10, 20, 30, 255]
      );
    });
  });

  describe("loadTexture", () => {
    test("replaces working canvas with provided canvas", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const externalCanvas = document.createElement("canvas");
      externalCanvas.width = 10;
      externalCanvas.height = 5;
      const ctx = externalCanvas.getContext("2d")!;
      ctx.fillStyle = "#0a141e";
      ctx.fillRect(3, 2, 1, 1);

      buf.loadTexture(externalCanvas);

      assert.deepStrictEqual(
        buf.size(),
        { x: 10, y: 5 }
      );
      assert.strictEqual(buf.canvas(), externalCanvas);
      assert.deepStrictEqual(buf.samplePixel(3, 2), [10, 20, 30, 255]);
      assert.deepStrictEqual(buf.samplePixel(0, 0), [0, 0, 0, 0]);
    });

    test("draws a decoded image into a new working canvas", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const painted = document.createElement("canvas");
      painted.width = 6;
      painted.height = 5;
      const ctx = context2d(painted);
      ctx.fillStyle = "#0a141e";
      ctx.fillRect(3, 2, 1, 1);

      buf.loadTexture(decodedImage(painted));

      assert.deepStrictEqual(buf.size(), { x: 6, y: 5 });
      assert.deepStrictEqual(
        readPixel(canvasPixels(buf.canvas()), { x: 3, y: 2 }, 6),
        [10, 20, 30, 255]
      );
      assert.deepStrictEqual(buf.samplePixel(3, 2), [10, 20, 30, 255]);
    });

    for (const source of [
      {
        name: "naturalWidth over width",
        natural: { width: 6, height: 5 },
        expected: { x: 6, y: 5 }
      },
      {
        name: "width when naturalWidth is 0",
        natural: { width: 0, height: 0 },
        expected: { x: 3, y: 2 }
      }
    ]) {
      test(`sizes an image source from its ${source.name}`, () => {
        const buf = new CanvasBuffer({
          size: { x: 4, y: 4 },
          maxSize: TEST_MAX_SIZE
        });
        const image = document.createElement("img");
        image.width = 3;
        image.height = 2;
        Object.defineProperties(image, {
          naturalWidth: { value: source.natural.width },
          naturalHeight: { value: source.natural.height }
        });

        buf.loadTexture(image);

        const canvas = buf.canvas();
        assert.deepStrictEqual(buf.size(), source.expected);
        assert.deepStrictEqual(
          { x: canvas.width, y: canvas.height },
          source.expected
        );
      });
    }

    test("rejects an oversized source before replacing working state", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: TEST_MAX_SIZE
      });
      const replaced: Vec2[] = [];
      buf.on("replaced", ({ size }) => {
        replaced.push(size);
      });
      const originalCanvas = buf.canvas();
      const oversized = document.createElement("canvas");
      oversized.width = TEST_MAX_SIZE + 1;
      oversized.height = 1;

      assert.throws(
        () => buf.loadTexture(oversized),
        RangeError
      );
      assert.strictEqual(buf.canvas(), originalCanvas);
      assert.deepStrictEqual(buf.size(), { x: 4, y: 4 });
      assert.deepStrictEqual(replaced, []);
    });
  });

  describe("resized / replaced signals", () => {
    function recordSurfaceEvents(
      buf: CanvasBuffer
    ): { resized: Vec2[]; replaced: Vec2[]; changed: number; } {
      const record = {
        resized: [] as Vec2[],
        replaced: [] as Vec2[],
        changed: 0
      };
      buf.on("resized", ({ size }) => {
        record.resized.push(size);
      });
      buf.on("replaced", ({ size }) => {
        record.replaced.push(size);
      });
      buf.on("changed", () => {
        record.changed++;
      });

      return record;
    }

    test("resize emits resized and keeps the same canvas element", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: TEST_MAX_SIZE });
      const before = buf.canvas();
      const record = recordSurfaceEvents(buf);

      buf.resize({ x: 8, y: 6 });

      assert.deepStrictEqual(record.resized, [{ x: 8, y: 6 }]);
      assert.deepStrictEqual(record.replaced, []);
      assert.strictEqual(record.changed, 0);
      assert.strictEqual(buf.canvas(), before);
    });

    test("loadTexture emits replaced and swaps the working canvas element", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: TEST_MAX_SIZE });
      const before = buf.canvas();
      const record = recordSurfaceEvents(buf);

      const source = document.createElement("canvas");
      source.width = 6;
      source.height = 5;
      buf.loadTexture(source);

      assert.deepStrictEqual(record.replaced, [{ x: 6, y: 5 }]);
      assert.deepStrictEqual(record.resized, []);
      assert.strictEqual(record.changed, 0);
      assert.notStrictEqual(buf.canvas(), before);
      assert.strictEqual(buf.canvas(), source);
    });
  });
});
