// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { BrushManager } from "../src/BrushManager.ts";
import { installCanvasMock } from "./mocks.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  installCanvasMock(globalThis.document);
});

describe("BrushManager", () => {
  describe("constructor defaults", () => {
    test("default color is black", () => {
      const brush = new BrushManager();
      assert.strictEqual(brush.getColorHex(), "#000000");
    });

    test("default size is 32", () => {
      const brush = new BrushManager();
      assert.strictEqual(brush.getSize(), 32);
    });

    test("default opacity is 1", () => {
      const brush = new BrushManager();
      assert.strictEqual(brush.getOpacity(), 1);
    });
  });

  describe("setColor / getColor", () => {
    test("setColor updates hex and rgba string", () => {
      const brush = new BrushManager();
      brush.setColor("#ff0000");
      assert.strictEqual(brush.getColorHex(), "#ff0000");
      assert.match(brush.getColor(), /rgba\(255, 0, 0/);
    });

    test("setColorWithOpacity updates opacity and color", () => {
      const brush = new BrushManager();
      brush.setColorWithOpacity("#0000ff", 0.5);
      assert.strictEqual(brush.getOpacity(), 0.5);
      assert.match(brush.getColor(), /rgba\(0, 0, 255, 0.5\)/);
    });
  });

  describe("setOpacity", () => {
    test("clamps opacity below 0", () => {
      const brush = new BrushManager();
      brush.setOpacity(-1);
      assert.strictEqual(brush.getOpacity(), 0);
    });

    test("clamps opacity above 1", () => {
      const brush = new BrushManager();
      brush.setOpacity(2);
      assert.strictEqual(brush.getOpacity(), 1);
    });

    test("re-derives RGB from stored hex on setOpacity", () => {
      const brush = new BrushManager({ color: "#ff0000" });
      brush.setOpacity(0.25);
      assert.match(brush.getColor(), /rgba\(255, 0, 0, 0.25\)/);
    });
  });

  describe("setSize / getSize", () => {
    test("clamps size to at least 1", () => {
      const brush = new BrushManager({ size: 0, maxSize: 10 });
      assert.strictEqual(brush.getSize(), 1);
    });

    test("clamps size to maxSize", () => {
      const brush = new BrushManager({ size: 100, maxSize: 8 });
      assert.strictEqual(brush.getSize(), 8);
    });
  });

  describe("getAffectedPixels", () => {
    test("size 1 affects only the center pixel", () => {
      const brush = new BrushManager({ size: 1, maxSize: 32 });
      const pixels = brush.getAffectedPixels(5, 5);
      assert.strictEqual(pixels.length, 1);
      assert.deepStrictEqual(pixels[0], { x: 5, y: 5 });
    });

    test("size 2 affects 4 pixels (even, offset left/up)", () => {
      const brush = new BrushManager({ size: 2, maxSize: 32 });
      const pixels = brush.getAffectedPixels(0, 0);
      assert.strictEqual(pixels.length, 4);
    });

    test("size 3 affects 9 pixels", () => {
      const brush = new BrushManager({ size: 3, maxSize: 32 });
      const pixels = brush.getAffectedPixels(5, 5);
      assert.strictEqual(pixels.length, 9);
    });

    test("size 4 affects 16 pixels", () => {
      const brush = new BrushManager({ size: 4, maxSize: 32 });
      const pixels = brush.getAffectedPixels(5, 5);
      assert.strictEqual(pixels.length, 16);
    });
  });
});
