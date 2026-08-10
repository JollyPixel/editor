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

// CONSTANTS
// Small master canvas size for fast tests (real default is 2048)
const kTestMaxSize = 32;

describe("CanvasBuffer", () => {
  describe("constructor", () => {
    test("size returns the initial size", () => {
      const buf = new CanvasBuffer({
        size: { x: 16, y: 8 },
        maxSize: kTestMaxSize
      });
      assert.deepStrictEqual(
        buf.size(),
        { x: 16, y: 8 }
      );
    });

    test("canvas returns a canvas with correct dimensions", () => {
      const buf = new CanvasBuffer({
        size: { x: 16, y: 16 },
        maxSize: kTestMaxSize
      });
      const canvas = buf.canvas();
      assert.strictEqual(canvas.width, 16);
      assert.strictEqual(canvas.height, 16);
    });

    test("exposes the validated maximum size", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });

      assert.strictEqual(buf.maxSize, kTestMaxSize);
    });
  });

  describe("drawPixels / samplePixel", () => {
    test("writes RGBA values to specified pixels", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([
        { x: 1, y: 1 }
      ], { r: 255, g: 0, b: 0, a: 255 });
      const [r, g, b, a] = buf.samplePixel(1, 1);
      assert.strictEqual(r, 255);
      assert.strictEqual(g, 0);
      assert.strictEqual(b, 0);
      assert.strictEqual(a, 255);
    });

    test("draws multiple pixels at once", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const pixels = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ];
      buf.drawPixels(pixels, { r: 0, g: 255, b: 0, a: 200 });
      for (const p of pixels) {
        const [r, g, b, a] = buf.samplePixel(p.x, p.y);
        assert.strictEqual(r, 0);
        assert.strictEqual(g, 255);
        assert.strictEqual(b, 0);
        assert.strictEqual(a, 200);
      }
    });

    test("syncs the working canvas with a single putImageData call regardless of pixel count", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
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

    test("leaves pixels inside the bounding box but outside the drawn set untouched on the canvas mirror", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      // Pre-existing pixel that sits strictly inside the bounding box of the
      // upcoming sparse drawPixels call, but isn't one of the drawn positions.
      buf.drawPixels(
        [
          { x: 2, y: 2 }
        ],
        { r: 1, g: 2, b: 3, a: 4 }
      );

      // Sparse diagonal draw whose bounding box covers (2,2).
      buf.drawPixels(
        [
          { x: 0, y: 0 },
          { x: 4, y: 4 }
        ],
        { r: 100, g: 100, b: 100, a: 255 }
      );

      assert.deepStrictEqual(
        buf.samplePixel(2, 2),
        [1, 2, 3, 4]
      );
      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [100, 100, 100, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(4, 4),
        [100, 100, 100, 255]
      );
    });

    test("accepts a lazy iterable (generator), not just an array", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      function* positions() {
        yield { x: 1, y: 1 };
        yield { x: 2, y: 2 };
      }

      buf.drawPixels(
        positions(),
        { r: 10, g: 20, b: 30, a: 255 }
      );
      assert.deepStrictEqual(
        buf.samplePixel(1, 1),
        [10, 20, 30, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(2, 2),
        [10, 20, 30, 255]
      );
    });

    test("skips the canvas sync entirely when every position is out of bounds", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
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

  describe("resize", () => {
    test("updates size", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      buf.resize({ x: 16, y: 4 });
      assert.deepStrictEqual(
        buf.size(),
        { x: 16, y: 4 }
      );
    });

    test("updates working canvas dimensions", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      buf.resize({ x: 20, y: 10 });
      const canvas = buf.canvas();
      assert.strictEqual(canvas.width, 20);
      assert.strictEqual(canvas.height, 10);
    });

    test("copies master data into new working canvas", () => {
      const buf = new CanvasBuffer({
        size: { x: 8, y: 8 },
        maxSize: kTestMaxSize
      });
      // Write a pixel and commit to master
      buf.drawPixels(
        [
          { x: 2, y: 2 }
        ],
        { r: 10, g: 20, b: 30, a: 255 }
      );
      buf.copyToMaster();
      // Resize to larger canvas — pixel at (2,2) should survive
      buf.resize({ x: 16, y: 16 });
      const [r, g, b, a] = buf.samplePixel(2, 2);
      assert.strictEqual(r, 10);
      assert.strictEqual(g, 20);
      assert.strictEqual(b, 30);
      assert.strictEqual(a, 255);
    });
  });

  describe("copyToMaster", () => {
    test("persists working canvas data across resize", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels(
        [
          { x: 0, y: 0 }
        ],
        { r: 100, g: 150, b: 200, a: 255 }
      );
      buf.copyToMaster();
      buf.resize({ x: 4, y: 4 });
      const [r, g, b, a] = buf.samplePixel(0, 0);
      assert.strictEqual(r, 100);
      assert.strictEqual(g, 150);
      assert.strictEqual(b, 200);
      assert.strictEqual(a, 255);
    });
  });

  describe("loadTexture", () => {
    test("replaces working canvas with provided canvas", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const externalCanvas = document.createElement("canvas");
      externalCanvas.width = 10;
      externalCanvas.height = 5;
      buf.loadTexture(externalCanvas);
      assert.deepStrictEqual(
        buf.size(),
        { x: 10, y: 5 }
      );
      assert.strictEqual(buf.canvas(), externalCanvas);
    });

    test("rejects an oversized source before replacing working state", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const originalCanvas = buf.canvas();
      const oversized = document.createElement("canvas");
      oversized.width = kTestMaxSize + 1;
      oversized.height = 1;

      assert.throws(
        () => buf.loadTexture(oversized),
        RangeError
      );
      assert.strictEqual(buf.canvas(), originalCanvas);
      assert.deepStrictEqual(buf.size(), { x: 4, y: 4 });
    });
  });

  describe("pixels", () => {
    test("returns Uint8ClampedArray of the correct length", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const pixels = buf.pixels();
      assert.strictEqual(pixels.length, 4 * 4 * 4);
    });
  });

  describe("drawRegion", () => {
    test("writes per-pixel colors and syncs the working canvas", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const red = { r: 255, g: 0, b: 0, a: 255 };
      const blue = { r: 0, g: 0, b: 255, a: 255 };

      buf.drawRegion({
        x: 0,
        y: 0,
        width: 2,
        height: 1
      }, [red, blue]);

      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [0, 0, 255, 255]
      );
    });

    test("clips to the in-bounds intersection when the rect extends past the buffer edge", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const color = { r: 9, g: 9, b: 9, a: 255 };

      assert.doesNotThrow(() => {
        buf.drawRegion({
          x: 2,
          y: 2,
          width: 4,
          height: 4
        }, new Array(16).fill(color));
      });
      assert.deepStrictEqual(
        buf.samplePixel(3, 3),
        [9, 9, 9, 255]
      );
    });

    test("syncs clipped top-left rows with their original source alignment", () => {
      const buf = new CanvasBuffer({
        size: { x: 2, y: 2 },
        maxSize: kTestMaxSize
      });
      const pixels = Array.from({ length: 9 }, (_, index) => {
        return {
          r: index,
          g: 0,
          b: 0,
          a: 255
        };
      });

      buf.drawRegion(
        { x: -1, y: -1, width: 3, height: 3 },
        pixels
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

    test("no-ops without throwing when the rect is entirely out of bounds", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const ctx = mockContextOf(buf.canvas());
      const before = ctx.putImageDataCallCount;

      assert.doesNotThrow(() => {
        buf.drawRegion({
          x: 10,
          y: 10,
          width: 2,
          height: 2
        }, new Array(4).fill({ r: 1, g: 1, b: 1, a: 1 }));
      });
      assert.strictEqual(ctx.putImageDataCallCount, before);
    });
  });

  describe("drawMaskedRegion", () => {
    test("writes only masked-true cells to both the buffer and its canvas mirror", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
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

      assert.deepStrictEqual(
        buf.samplePixel(0, 0),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        buf.samplePixel(1, 0),
        [1, 2, 3, 4],
        "masked-false cell untouched"
      );
    });

    test("no-ops without throwing when the rect is entirely out of bounds", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        maxSize: kTestMaxSize
      });
      const ctx = mockContextOf(buf.canvas());
      const before = ctx.putImageDataCallCount;

      assert.doesNotThrow(() => {
        buf.drawMaskedRegion(
          { x: 10, y: 10, width: 2, height: 2 },
          new Array(4).fill({ r: 1, g: 1, b: 1, a: 1 }),
          new Array(4).fill(true)
        );
      });
      assert.strictEqual(ctx.putImageDataCallCount, before);
    });
  });

  describe("hasTransparency", () => {
    test("returns false when every pixel in rect is fully opaque", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: kTestMaxSize
      });

      assert.strictEqual(
        buf.hasTransparency({ x: 1, y: 1, width: 2, height: 2 }),
        false
      );
    });

    test("returns true when a pixel in rect isn't fully opaque", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: kTestMaxSize
      });
      buf.drawPixels([{ x: 2, y: 2 }], { r: 0, g: 0, b: 0, a: 0 });

      assert.strictEqual(
        buf.hasTransparency({ x: 1, y: 1, width: 2, height: 2 }),
        true
      );
    });

    test("treats a rect extending past the buffer edge as transparent", () => {
      const buf = new CanvasBuffer({
        size: { x: 4, y: 4 },
        defaultColor: { r: 1, g: 2, b: 3, a: 255 },
        maxSize: kTestMaxSize
      });

      assert.strictEqual(
        buf.hasTransparency({ x: 2, y: 2, width: 4, height: 4 }),
        true
      );
    });
  });

  describe("changed signal", () => {
    function countChanges(
      buf: CanvasBuffer
    ): () => number {
      let count = 0;
      buf.on("changed", () => {
        count++;
      });

      return () => count;
    }

    test("emits once per drawPixels", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const changes = countChanges(buf);

      buf.drawPixels([{ x: 1, y: 1 }], { r: 1, g: 2, b: 3, a: 4 });

      assert.strictEqual(changes(), 1);
    });

    test("emits once per drawRegion", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const changes = countChanges(buf);

      buf.drawRegion(
        { x: 0, y: 0, width: 2, height: 2 },
        new Array(4).fill({ r: 1, g: 1, b: 1, a: 1 })
      );

      assert.strictEqual(changes(), 1);
    });

    test("emits once per drawMaskedRegion", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const changes = countChanges(buf);

      buf.drawMaskedRegion(
        { x: 0, y: 0, width: 2, height: 2 },
        new Array(4).fill({ r: 1, g: 1, b: 1, a: 1 }),
        new Array(4).fill(true)
      );

      assert.strictEqual(changes(), 1);
    });

    test("emits once for multiple color groups", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const changes = countChanges(buf);

      buf.drawColorGroups([
        {
          color: { r: 255, g: 0, b: 0, a: 255 },
          positions: [{ x: 0, y: 0 }]
        },
        {
          color: { r: 0, g: 0, b: 255, a: 255 },
          positions: [{ x: 1, y: 0 }]
        }
      ]);

      assert.strictEqual(changes(), 1);
      assert.deepStrictEqual(buf.samplePixel(0, 0), [255, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(1, 0), [0, 0, 255, 255]);
    });

    test("does not emit on size-changing ops or copyToMaster", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: kTestMaxSize });
      const changes = countChanges(buf);

      buf.copyToMaster();
      buf.resize({ x: 8, y: 8 });
      buf.replacePixels(new Uint8ClampedArray(4 * 4 * 4), { x: 4, y: 4 });

      assert.strictEqual(
        changes(),
        0,
        "callers repaint these explicitly after resizing the viewport texture"
      );
    });
  });
});
