// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import { Brush } from "#src/tools/Brush.ts";

describe("Brush", () => {
  describe("constructor defaults", () => {
    test("default primary color is black", () => {
      const brush = new Brush();
      assert.strictEqual(
        brush.primary.asString("hex"),
        "#000000"
      );
    });

    test("default secondary color is white", () => {
      const brush = new Brush();
      assert.strictEqual(
        brush.secondary.asString("hex"),
        "#ffffff"
      );
    });

    test("default size is 32", () => {
      const brush = new Brush();
      assert.strictEqual(brush.size, 32);
    });

    test("default primary opacity is 1", () => {
      const brush = new Brush();
      assert.strictEqual(brush.primary.opacity, 1);
    });

    test("default secondary opacity is 1", () => {
      const brush = new Brush();
      assert.strictEqual(brush.secondary.opacity, 1);
    });

    test("primary.asString() is a valid rgba() string right after construction", () => {
      const brush = new Brush();
      assert.match(
        brush.primary.asString(),
        /rgba\(0, 0, 0, 1\)/
      );
    });

    test("constructor accepts a secondaryColor option", () => {
      const brush = new Brush({
        secondaryColor: "#00ff00"
      });
      assert.strictEqual(
        brush.secondary.asString("hex"),
        "#00ff00"
      );
    });
  });

  describe("primary.set / primary.asString", () => {
    test("set updates hex and rgba string", () => {
      const brush = new Brush();
      brush.primary.set("#ff0000");
      assert.strictEqual(
        brush.primary.asString("hex"),
        "#ff0000"
      );
      assert.match(
        brush.primary.asString(),
        /rgba\(255, 0, 0/
      );
    });

    test("set with opacity argument updates opacity and color", () => {
      const brush = new Brush();
      brush.primary.set("#0000ff", 0.5);
      assert.strictEqual(brush.primary.opacity, 0.5);
      assert.match(
        brush.primary.asString(),
        /rgba\(0, 0, 255, 0.5\)/
      );
    });

    test("set accepts a colorjs.io Color instance", () => {
      const brush = new Brush();
      brush.primary.set(new Color("lime"));
      assert.strictEqual(
        brush.primary.asString("hex"),
        "#00ff00"
      );
      assert.match(
        brush.primary.asString(),
        /rgba\(0, 255, 0/
      );
    });

    test("constructor accepts a colorjs.io Color instance", () => {
      const brush = new Brush({ color: new Color("blue") });
      assert.strictEqual(
        brush.primary.asString("hex"),
        "#0000ff"
      );
    });

    test("asRGBA returns byte components without exposing mutable state", () => {
      const brush = new Brush({ color: "#123456" });
      brush.primary.opacity = 0.5;

      const rgba = brush.primary.asRGBA();
      assert.deepStrictEqual(
        rgba,
        { r: 18, g: 52, b: 86, a: 128 }
      );

      rgba.r = 255;
      assert.strictEqual(brush.primary.asRGBA().r, 18);
    });
  });

  describe("opacity", () => {
    test("clamps opacity below 0", () => {
      const brush = new Brush();
      brush.primary.opacity = -1;
      assert.strictEqual(brush.primary.opacity, 0);
    });

    test("clamps opacity above 1", () => {
      const brush = new Brush();
      brush.primary.opacity = 2;
      assert.strictEqual(brush.primary.opacity, 1);
    });

    test("re-derives RGB from stored hex on opacity change", () => {
      const brush = new Brush({ color: "#ff0000" });
      brush.primary.opacity = 0.25;
      assert.match(
        brush.primary.asString(),
        /rgba\(255, 0, 0, 0.25\)/
      );
    });

    test("secondary opacity is independent from primary", () => {
      const brush = new Brush();
      brush.secondary.opacity = 0.25;
      assert.strictEqual(brush.primary.opacity, 1);
      assert.strictEqual(brush.secondary.opacity, 0.25);
    });
  });

  describe("swapColors", () => {
    test("exchanges primary and secondary color and opacity", () => {
      const brush = new Brush({
        color: "#ff0000",
        secondaryColor: "#0000ff"
      });
      brush.secondary.opacity = 0.5;

      brush.swapColors();

      assert.strictEqual(
        brush.primary.asString("hex"),
        "#0000ff"
      );
      assert.strictEqual(brush.primary.opacity, 0.5);
      assert.strictEqual(
        brush.secondary.asString("hex"),
        "#ff0000"
      );
      assert.strictEqual(brush.secondary.opacity, 1);
    });
  });

  describe("size", () => {
    test("clamps size to at least 1", () => {
      const brush = new Brush({
        size: 0,
        maxSize: 10
      });
      assert.strictEqual(brush.size, 1);
    });

    test("clamps size to maxSize", () => {
      const brush = new Brush({
        size: 100,
        maxSize: 8
      });
      assert.strictEqual(brush.size, 8);
    });
  });

  describe("affectedPixels", () => {
    test("returns an iterable, not an array", () => {
      const brush = new Brush({ size: 1, maxSize: 32 });
      const result = brush.affectedPixels(5, 5);
      assert.ok(!Array.isArray(result));
      assert.strictEqual(
        typeof result[Symbol.iterator],
        "function"
      );
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
