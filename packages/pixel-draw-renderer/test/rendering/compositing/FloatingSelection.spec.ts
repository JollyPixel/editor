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
  ERASE_COLOR,
  TRANSPARENT
} from "../../helpers/compositing/colors.ts";

describe("FloatingSelection", () => {
  describe("draw", () => {
    test("is a no-op when nothing has been created", () => {
      const overlay = new FloatingSelection();
      const dest = makeCanvas(10);

      assert.doesNotThrow(
        () => overlay.draw(
          mockContextOf(dest).asRenderingContext()
        ),
        "draw should not throw when nothing has been created"
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 0, y: 0 }, dest.width),
        [0, 0, 0, 0]
      );
    });

    test("is a no-op after clear()", () => {
      const overlay = new FloatingSelection();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [RED],
        eraseColor: ERASE_COLOR
      });
      overlay.clear();

      const dest = makeCanvas(10);
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 0, y: 0 }, dest.width),
        [0, 0, 0, 0]
      );
    });
  });

  describe("create + draw", () => {
    test("blits the captured pixels at sourceRect by default", () => {
      const overlay = new FloatingSelection();
      overlay.create({
        sourceRect: {
          x: 2,
          y: 3,
          width: 2,
          height: 1
        },
        pixels: [RED, BLUE],
        eraseColor: ERASE_COLOR
      });

      const dest = makeCanvas(10);
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 2, y: 3 }, dest.width),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 3, y: 3 }, dest.width),
        [0, 0, 255, 255]
      );
    });
  });

  describe("updatePosition", () => {
    test("moves the live overlay while leaving the source position blanked", () => {
      const overlay = new FloatingSelection();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [RED],
        eraseColor: ERASE_COLOR
      });
      overlay.updatePosition({
        x: 5,
        y: 5,
        width: 1,
        height: 1
      });

      const dest = makeCanvas(10);
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 0, y: 0 }, dest.width),
        [9, 9, 9, 255]
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 5, y: 5 }, dest.width),
        [255, 0, 0, 255]
      );
    });

    test("blankSource: false leaves the source position untouched", () => {
      const overlay = new FloatingSelection();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [RED],
        eraseColor: ERASE_COLOR,
        blankSource: false
      });
      overlay.updatePosition({
        x: 5,
        y: 5,
        width: 1,
        height: 1
      });

      const dest = makeCanvas(10);
      overlay.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 0, y: 0 }, dest.width),
        [0, 0, 0, 0]
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 5, y: 5 }, dest.width),
        [255, 0, 0, 255]
      );
    });

    test("a transparent erase color removes source pixels instead of compositing over them", () => {
      const overlay = new FloatingSelection();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 2,
          height: 1
        },
        pixels: [RED, RED],
        eraseColor: TRANSPARENT
      });
      overlay.updatePosition({
        x: 1,
        y: 0,
        width: 2,
        height: 1
      });

      const dest = makeCanvas(10);
      const destCtx = mockContextOf(dest);
      const initial = destCtx.createImageData(2, 1);
      initial.data.set([
        255, 0, 0, 255,
        255, 0, 0, 255
      ]);
      destCtx.putImageData(initial, 0, 0);
      overlay.draw(destCtx.asRenderingContext());

      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 0, y: 0 }, dest.width),
        [0, 0, 0, 0],
        "the non-overlapping source edge is transparent during the drag"
      );
      assert.deepStrictEqual(
        readPixel(canvasPixels(dest), { x: 1, y: 0 }, dest.width),
        [255, 0, 0, 255],
        "the moved selection is visible at its destination"
      );
    });
  });
});
