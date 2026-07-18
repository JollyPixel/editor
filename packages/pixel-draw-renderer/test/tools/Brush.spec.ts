// Import Node.js Dependencies
import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";
import Color from "colorjs.io";

// Import Internal Dependencies
import { Brush } from "../../src/tools/Brush.ts";
import { installCanvasMock } from "../mocks.ts";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

before(() => {
  globalThis.document = kEmulatedBrowserWindow.document as unknown as Document;
  installCanvasMock(globalThis.document);
});

describe("Brush", () => {
  describe("constructor defaults", () => {
    test("default color is black", () => {
      const brush = new Brush();
      assert.strictEqual(brush.colorAsString("hex"), "#000000");
    });

    test("default size is 32", () => {
      const brush = new Brush();
      assert.strictEqual(brush.size, 32);
    });

    test("default opacity is 1", () => {
      const brush = new Brush();
      assert.strictEqual(brush.opacity, 1);
    });

    test("colorAsString() is a valid rgba() string right after construction", () => {
      const brush = new Brush();
      assert.match(brush.colorAsString(), /rgba\(0, 0, 0, 1\)/);
    });
  });

  describe("color / colorAsString", () => {
    test("color updates hex and rgba string", () => {
      const brush = new Brush();
      brush.color("#ff0000");
      assert.strictEqual(brush.colorAsString("hex"), "#ff0000");
      assert.match(brush.colorAsString(), /rgba\(255, 0, 0/);
    });

    test("color with opacity argument updates opacity and color", () => {
      const brush = new Brush();
      brush.color("#0000ff", 0.5);
      assert.strictEqual(brush.opacity, 0.5);
      assert.match(brush.colorAsString(), /rgba\(0, 0, 255, 0.5\)/);
    });

    test("color accepts a colorjs.io Color instance", () => {
      const brush = new Brush();
      brush.color(new Color("lime"));
      assert.strictEqual(brush.colorAsString("hex"), "#00ff00");
      assert.match(brush.colorAsString(), /rgba\(0, 255, 0/);
    });

    test("constructor accepts a colorjs.io Color instance", () => {
      const brush = new Brush({ color: new Color("blue") });
      assert.strictEqual(brush.colorAsString("hex"), "#0000ff");
    });
  });

  describe("opacity", () => {
    test("clamps opacity below 0", () => {
      const brush = new Brush();
      brush.opacity = -1;
      assert.strictEqual(brush.opacity, 0);
    });

    test("clamps opacity above 1", () => {
      const brush = new Brush();
      brush.opacity = 2;
      assert.strictEqual(brush.opacity, 1);
    });

    test("re-derives RGB from stored hex on opacity change", () => {
      const brush = new Brush({ color: "#ff0000" });
      brush.opacity = 0.25;
      assert.match(brush.colorAsString(), /rgba\(255, 0, 0, 0.25\)/);
    });
  });

  describe("size", () => {
    test("clamps size to at least 1", () => {
      const brush = new Brush({ size: 0, maxSize: 10 });
      assert.strictEqual(brush.size, 1);
    });

    test("clamps size to maxSize", () => {
      const brush = new Brush({ size: 100, maxSize: 8 });
      assert.strictEqual(brush.size, 8);
    });
  });

  describe("affectedPixels", () => {
    test("returns an iterable, not an array", () => {
      const brush = new Brush({ size: 1, maxSize: 32 });
      const result = brush.affectedPixels(5, 5);
      assert.strictEqual(Array.isArray(result), false);
      assert.strictEqual(typeof result[Symbol.iterator], "function");
    });

    test("size 1 affects only the center pixel", () => {
      const brush = new Brush({ size: 1, maxSize: 32 });
      const pixels = [...brush.affectedPixels(5, 5)];
      assert.strictEqual(pixels.length, 1);
      assert.deepStrictEqual(pixels[0], { x: 5, y: 5 });
    });

    test("size 2 affects 4 pixels (even, offset left/up)", () => {
      const brush = new Brush({ size: 2, maxSize: 32 });
      const pixels = [...brush.affectedPixels(0, 0)];
      assert.strictEqual(pixels.length, 4);
    });

    test("size 3 affects 9 pixels", () => {
      const brush = new Brush({ size: 3, maxSize: 32 });
      const pixels = [...brush.affectedPixels(5, 5)];
      assert.strictEqual(pixels.length, 9);
    });

    test("size 4 affects 16 pixels", () => {
      const brush = new Brush({ size: 4, maxSize: 32 });
      const pixels = [...brush.affectedPixels(5, 5)];
      assert.strictEqual(pixels.length, 16);
    });
  });
});
