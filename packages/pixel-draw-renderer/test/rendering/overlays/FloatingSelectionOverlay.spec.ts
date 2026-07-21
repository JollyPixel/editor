// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FloatingSelectionOverlay
} from "#src/rendering/overlays/FloatingSelectionOverlay.ts";
import {
  canvasPixels,
  mockContextOf
} from "../../fixtures/canvas.ts";
import type { RGBA } from "#src/types.ts";

// CONSTANTS
const kRed: RGBA = {
  r: 255,
  g: 0,
  b: 0,
  a: 255
};
const kBlue: RGBA = {
  r: 0,
  g: 0,
  b: 255,
  a: 255
};
const kErase: RGBA = {
  r: 9,
  g: 9,
  b: 9,
  a: 255
};

function makeDest(): HTMLCanvasElement {
  const dest = document.createElement("canvas");
  dest.width = 10;
  dest.height = 10;

  return dest;
}

function pixelAt(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): [number, number, number, number] {
  const pixels = canvasPixels(canvas);
  const index = (y * canvas.width + x) * 4;

  return [
    pixels[index],
    pixels[index + 1],
    pixels[index + 2],
    pixels[index + 3]
  ];
}

describe("FloatingSelectionOverlay", () => {
  describe("draw", () => {
    test("is a no-op when nothing has been created", () => {
      const overlay = new FloatingSelectionOverlay();
      const dest = makeDest();

      assert.doesNotThrow(
        () => overlay.draw(
          mockContextOf(dest).asRenderingContext()
        ),
        "draw should not throw when nothing has been created"
      );
      assert.deepStrictEqual(
        pixelAt(dest, 0, 0),
        [0, 0, 0, 0]
      );
    });

    test("is a no-op after clear()", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [kRed],
        eraseColor: kErase
      });
      overlay.clear();

      const dest = makeDest();
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );
      assert.deepStrictEqual(
        pixelAt(dest, 0, 0),
        [0, 0, 0, 0]
      );
    });
  });

  describe("create + draw", () => {
    test("blits the captured pixels at sourceRect by default", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 2,
          y: 3,
          width: 2,
          height: 1
        },
        pixels: [kRed, kBlue],
        eraseColor: kErase
      });

      const dest = makeDest();
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        pixelAt(dest, 2, 3),
        [255, 0, 0, 255]
      );
      assert.deepStrictEqual(
        pixelAt(dest, 3, 3),
        [0, 0, 255, 255]
      );
    });
  });

  describe("updatePosition", () => {
    test("moves the live overlay while leaving the source position blanked", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [kRed],
        eraseColor: kErase
      });
      overlay.updatePosition({
        x: 5,
        y: 5,
        width: 1,
        height: 1
      });

      const dest = makeDest();
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        pixelAt(dest, 0, 0),
        [9, 9, 9, 255]
      );
      assert.deepStrictEqual(
        pixelAt(dest, 5, 5),
        [255, 0, 0, 255]
      );
    });

    test("blankSource: false leaves the source position untouched", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [kRed],
        eraseColor: kErase,
        blankSource: false
      });
      overlay.updatePosition({
        x: 5,
        y: 5,
        width: 1,
        height: 1
      });

      const dest = makeDest();
      overlay.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(
        pixelAt(dest, 0, 0),
        [0, 0, 0, 0]
      );
      assert.deepStrictEqual(
        pixelAt(dest, 5, 5),
        [255, 0, 0, 255]
      );
    });

    test("is a no-op when nothing has been created", () => {
      const overlay = new FloatingSelectionOverlay();

      assert.doesNotThrow(
        () => overlay.updatePosition({
          x: 5,
          y: 5,
          width: 1,
          height: 1
        })
      );
    });
  });

  describe("mask", () => {
    test("masked-false cells are transparent in the content canvas, masked-true cells show through", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 2,
          y: 3,
          width: 2,
          height: 1
        },
        pixels: [kRed, kBlue],
        mask: [true, false],
        eraseColor: kErase
      });

      const dest = makeDest();
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        pixelAt(dest, 2, 3),
        [255, 0, 0, 255],
        "masked-true cell painted"
      );
      assert.strictEqual(
        pixelAt(dest, 3, 3)[3],
        0,
        "masked-false cell is fully transparent (alpha 0)"
      );
    });

    test("blanking the source only erases masked-true cells, leaving masked-false cells' underlying content", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 2,
          height: 1
        },
        pixels: [kRed, kBlue],
        mask: [true, false],
        eraseColor: kErase
      });
      overlay.updatePosition({
        x: 5,
        y: 5,
        width: 2,
        height: 1
      });

      const dest = makeDest();
      overlay.draw(
        mockContextOf(dest).asRenderingContext()
      );

      assert.deepStrictEqual(
        pixelAt(dest, 0, 0),
        [9, 9, 9, 255],
        "masked-true source cell blanked"
      );
      assert.deepStrictEqual(
        pixelAt(dest, 1, 0),
        [0, 0, 0, 0],
        "masked-false source cell left alone (nothing drawn)"
      );
    });

    test("omitting mask behaves exactly like an all-true mask (backward compatible)", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        pixels: [kRed],
        eraseColor: kErase
      });

      const dest = makeDest();
      overlay.draw(mockContextOf(dest).asRenderingContext());

      assert.deepStrictEqual(
        pixelAt(dest, 0, 0),
        [255, 0, 0, 255],
        "omitting mask behaves exactly like an all-true mask (backward compatible)"
      );
    });
  });

  describe("changed signal", () => {
    function makeCreated(): {
      overlay: FloatingSelectionOverlay;
      changes: () => number;
    } {
      const overlay = new FloatingSelectionOverlay();
      let count = 0;
      overlay.on("changed", () => {
        count++;
      });

      return { overlay, changes: () => count };
    }

    const kSourceRect = { x: 0, y: 0, width: 1, height: 1 };

    test("emits on create, updatePosition, and clear", () => {
      const { overlay, changes } = makeCreated();

      overlay.create({
        sourceRect: kSourceRect,
        pixels: [kRed],
        eraseColor: kErase
      });
      assert.strictEqual(changes(), 1, "create");

      overlay.updatePosition({ x: 2, y: 2, width: 1, height: 1 });
      assert.strictEqual(changes(), 2, "updatePosition");

      overlay.clear();
      assert.strictEqual(changes(), 3, "clear");
    });

    test("clear does not emit when nothing is floating", () => {
      const { overlay, changes } = makeCreated();

      overlay.clear();

      assert.strictEqual(changes(), 0);
    });

    test("updatePosition does not emit when nothing is floating", () => {
      const { overlay, changes } = makeCreated();

      overlay.updatePosition({ x: 1, y: 1, width: 1, height: 1 });

      assert.strictEqual(changes(), 0);
    });
  });
});
