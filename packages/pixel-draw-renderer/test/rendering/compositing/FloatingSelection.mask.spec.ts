// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FloatingSelection
} from "#src/rendering/compositing/FloatingSelection.ts";
import {
  canvasPixels,
  mockContextOf,
  readPixel
} from "../../fixtures/canvas.ts";
import { makeCanvas } from "../../helpers/dom.ts";
import {
  RED,
  BLUE,
  ERASE_COLOR
} from "../../helpers/compositing/colors.ts";

describe("FloatingSelection", () => {
  describe("mask", () => {
    test("masked-false cells are transparent in the content canvas, masked-true cells show through", () => {
      const overlay = new FloatingSelection();
      overlay.create({
        sourceRect: {
          x: 2,
          y: 3,
          width: 2,
          height: 1
        },
        pixels: [RED, BLUE],
        mask: [true, false],
        eraseColor: ERASE_COLOR
      });

      const dest = makeCanvas(10);
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 2, y: 3 }, dest.width),
        [255, 0, 0, 255],
        "masked-true cell painted"
      );
      assert.strictEqual(
        readPixel(canvasPixels(dest), { x: 3, y: 3 }, dest.width)[3],
        0,
        "masked-false cell is fully transparent (alpha 0)"
      );
    });

    test(
      "blanking the source only erases masked-true cells, leaving masked-false cells' underlying content",
      () => {
        const overlay = new FloatingSelection();
        overlay.create({
          sourceRect: {
            x: 0,
            y: 0,
            width: 2,
            height: 1
          },
          pixels: [RED, BLUE],
          mask: [true, false],
          eraseColor: ERASE_COLOR
        });
        overlay.updatePosition({
          x: 5,
          y: 5,
          width: 2,
          height: 1
        });

        const dest = makeCanvas(10);
        const destCtx = mockContextOf(dest);
        const underlying = destCtx.createImageData(2, 1);
        underlying.data.set([
          0, 255, 0, 255,
          0, 255, 0, 255
        ]);
        destCtx.putImageData(underlying, 0, 0);
        overlay.draw(destCtx.asRenderingContext());

        assert.deepStrictEqual(
          readPixel(canvasPixels(dest), { x: 0, y: 0 }, dest.width),
          [9, 9, 9, 255],
          "masked-true source cell blanked"
        );
        assert.deepStrictEqual(
          readPixel(canvasPixels(dest), { x: 1, y: 0 }, dest.width),
          [0, 255, 0, 255],
          "masked-false source cell keeps its underlying content"
        );
      }
    );
  });
});
