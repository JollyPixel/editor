// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { FloatingSelectionOverlay } from "../../../src/rendering/overlays/FloatingSelectionOverlay.ts";
import { installCanvasMock, MockCanvasElement } from "../../mocks.ts";
import type { RGBA } from "../../../src/types.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();
const kRed: RGBA = { r: 255, g: 0, b: 0, a: 255 };
const kBlue: RGBA = { r: 0, g: 0, b: 255, a: 255 };
const kErase: RGBA = { r: 9, g: 9, b: 9, a: 255 };

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  installCanvasMock(globalThis.document);
});

function makeDest(): MockCanvasElement {
  const dest = new MockCanvasElement();
  dest.width = 10;
  dest.height = 10;

  return dest;
}

function pixelAt(
  canvas: MockCanvasElement,
  x: number,
  y: number
): [number, number, number, number] {
  const index = (y * canvas.width + x) * 4;

  return [
    canvas._pixels[index],
    canvas._pixels[index + 1],
    canvas._pixels[index + 2],
    canvas._pixels[index + 3]
  ];
}

describe("FloatingSelectionOverlay", () => {
  describe("draw", () => {
    test("is a no-op when nothing has been created", () => {
      const overlay = new FloatingSelectionOverlay();
      const dest = makeDest();

      assert.doesNotThrow(() => overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D));
      assert.deepStrictEqual(pixelAt(dest, 0, 0), [0, 0, 0, 0]);
    });

    test("is a no-op after clear()", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 0, y: 0, width: 1, height: 1 },
        pixels: [kRed],
        eraseColor: kErase
      });
      overlay.clear();

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);
      assert.deepStrictEqual(pixelAt(dest, 0, 0), [0, 0, 0, 0]);
    });
  });

  describe("create + draw", () => {
    test("blits the captured pixels at sourceRect by default", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 2, y: 3, width: 2, height: 1 },
        pixels: [kRed, kBlue],
        eraseColor: kErase
      });

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);

      assert.deepStrictEqual(pixelAt(dest, 2, 3), [255, 0, 0, 255]);
      assert.deepStrictEqual(pixelAt(dest, 3, 3), [0, 0, 255, 255]);
    });
  });

  describe("updatePosition", () => {
    test("moves the live overlay while leaving the source position blanked", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 0, y: 0, width: 1, height: 1 },
        pixels: [kRed],
        eraseColor: kErase
      });
      overlay.updatePosition({ x: 5, y: 5, width: 1, height: 1 });

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);

      assert.deepStrictEqual(pixelAt(dest, 0, 0), [9, 9, 9, 255]);
      assert.deepStrictEqual(pixelAt(dest, 5, 5), [255, 0, 0, 255]);
    });

    test("blankSource: false leaves the source position untouched", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 0, y: 0, width: 1, height: 1 },
        pixels: [kRed],
        eraseColor: kErase,
        blankSource: false
      });
      overlay.updatePosition({ x: 5, y: 5, width: 1, height: 1 });

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);

      assert.deepStrictEqual(pixelAt(dest, 0, 0), [0, 0, 0, 0]);
      assert.deepStrictEqual(pixelAt(dest, 5, 5), [255, 0, 0, 255]);
    });

    test("is a no-op when nothing has been created", () => {
      const overlay = new FloatingSelectionOverlay();

      assert.doesNotThrow(() => overlay.updatePosition({ x: 5, y: 5, width: 1, height: 1 }));
    });
  });

  describe("mask", () => {
    test("masked-false cells are transparent in the content canvas, masked-true cells show through", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 2, y: 3, width: 2, height: 1 },
        pixels: [kRed, kBlue],
        mask: [true, false],
        eraseColor: kErase
      });

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);

      assert.deepStrictEqual(pixelAt(dest, 2, 3), [255, 0, 0, 255], "masked-true cell painted");
      assert.strictEqual(pixelAt(dest, 3, 3)[3], 0, "masked-false cell is fully transparent (alpha 0)");
    });

    test("blanking the source only erases masked-true cells, leaving masked-false cells' underlying content", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 0, y: 0, width: 2, height: 1 },
        pixels: [kRed, kBlue],
        mask: [true, false],
        eraseColor: kErase
      });
      overlay.updatePosition({ x: 5, y: 5, width: 2, height: 1 });

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);

      assert.deepStrictEqual(pixelAt(dest, 0, 0), [9, 9, 9, 255], "masked-true source cell blanked");
      assert.deepStrictEqual(pixelAt(dest, 1, 0), [0, 0, 0, 0], "masked-false source cell left alone (nothing drawn)");
    });

    test("omitting mask behaves exactly like an all-true mask (backward compatible)", () => {
      const overlay = new FloatingSelectionOverlay();
      overlay.create({
        sourceRect: { x: 0, y: 0, width: 1, height: 1 },
        pixels: [kRed],
        eraseColor: kErase
      });

      const dest = makeDest();
      overlay.draw(dest._ctx as unknown as CanvasRenderingContext2D);

      assert.deepStrictEqual(pixelAt(dest, 0, 0), [255, 0, 0, 255]);
    });
  });
});
