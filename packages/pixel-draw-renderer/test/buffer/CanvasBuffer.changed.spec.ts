// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CanvasBuffer } from "#src/buffer/CanvasBuffer.ts";
import type { SelectionRect } from "#src/types.ts";
import { TEST_MAX_SIZE } from "../helpers/buffer/maxSize.ts";

describe("CanvasBuffer", () => {
  describe("changed signal", () => {
    test("does not emit on size-changing ops or copyToMaster", () => {
      const buf = new CanvasBuffer({ size: { x: 4, y: 4 }, maxSize: TEST_MAX_SIZE });
      let changes = 0;
      buf.on("changed", () => {
        changes++;
      });

      buf.copyToMaster();
      buf.resize({ x: 8, y: 8 });
      buf.replacePixels(new Uint8ClampedArray(4 * 4 * 4), { x: 4, y: 4 });

      assert.strictEqual(
        changes,
        0,
        "callers repaint these explicitly after resizing the viewport texture"
      );
    });
  });

  describe("changed bounds", () => {
    function boundsOf(
      buf: CanvasBuffer
    ): () => SelectionRect[] {
      const seen: SelectionRect[] = [];
      buf.on("changed", ({ bounds }) => {
        seen.push(bounds);
      });

      return () => seen;
    }

    test("drawPixels reports the bounding box of the written pixels", () => {
      const buf = new CanvasBuffer({ size: { x: 8, y: 8 }, maxSize: TEST_MAX_SIZE });
      const bounds = boundsOf(buf);

      buf.drawPixels(
        [{ x: 1, y: 2 }, { x: 4, y: 3 }],
        { r: 1, g: 2, b: 3, a: 255 }
      );

      assert.deepStrictEqual(
        bounds(),
        [{ x: 1, y: 2, width: 4, height: 2 }]
      );
    });

    test("drawColorGroups writes every group and reports their union once", () => {
      const buf = new CanvasBuffer({ size: { x: 8, y: 8 }, maxSize: TEST_MAX_SIZE });
      const bounds = boundsOf(buf);

      buf.drawColorGroups([
        {
          color: { r: 255, g: 0, b: 0, a: 255 },
          positions: [{ x: 0, y: 0 }]
        },
        {
          color: { r: 0, g: 0, b: 255, a: 255 },
          positions: [{ x: 5, y: 6 }]
        }
      ]);

      assert.deepStrictEqual(
        bounds(),
        [{ x: 0, y: 0, width: 6, height: 7 }]
      );
      assert.deepStrictEqual(buf.samplePixel(0, 0), [255, 0, 0, 255]);
      assert.deepStrictEqual(buf.samplePixel(5, 6), [0, 0, 255, 255]);
    });

    test("drawMaskedRegion reports the written rect", () => {
      const buf = new CanvasBuffer({ size: { x: 8, y: 8 }, maxSize: TEST_MAX_SIZE });
      const bounds = boundsOf(buf);
      const rect = { x: 0, y: 0, width: 2, height: 2 };

      buf.drawMaskedRegion(
        rect,
        Array.from({ length: 4 }, () => {
          return { r: 1, g: 1, b: 1, a: 255 };
        }),
        [true, false, false, true]
      );

      assert.deepStrictEqual(bounds(), [rect]);
    });
  });
});
