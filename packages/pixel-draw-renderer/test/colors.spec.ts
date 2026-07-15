// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import { getColorAsRGBA, toRGBA } from "../src/colors.ts";

describe("getColorAsRGBA", () => {
  test("returns opaque white for #ffffff", () => {
    const [r, g, b, a] = getColorAsRGBA("#ffffff");
    assert.strictEqual(r, 255);
    assert.strictEqual(g, 255);
    assert.strictEqual(b, 255);
    assert.strictEqual(a, 255);
  });

  test("returns opaque black for #000000", () => {
    const [r, g, b, a] = getColorAsRGBA("#000000");
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
    assert.strictEqual(a, 255);
  });

  test("returns four components", () => {
    const result = getColorAsRGBA("#ff0000");
    assert.strictEqual(result.length, 4);
  });

  test("reads explicit alpha from #rrggbbaa", () => {
    const result = getColorAsRGBA("#ff000080");
    assert.deepStrictEqual(result, [255, 0, 0, 128]);
  });

  test("expands #rgb shorthand", () => {
    const result = getColorAsRGBA("#0f0");
    assert.deepStrictEqual(result, [0, 255, 0, 255]);
  });

  test("expands #rgba shorthand", () => {
    const result = getColorAsRGBA("#0f08");
    assert.deepStrictEqual(result, [0, 255, 0, 136]);
  });

  test("accepts a named CSS color", () => {
    const result = getColorAsRGBA("red");
    assert.deepStrictEqual(result, [255, 0, 0, 255]);
  });

  test("accepts an rgb() string", () => {
    const result = getColorAsRGBA("rgb(0, 0, 255)");
    assert.deepStrictEqual(result, [0, 0, 255, 255]);
  });

  test("accepts an hsl() string with alpha", () => {
    const result = getColorAsRGBA("hsl(0 100% 50% / 0.5)");
    assert.deepStrictEqual(result, [255, 0, 0, 128]);
  });

  test("accepts a colorjs.io Color instance", () => {
    const result = getColorAsRGBA(new Color("#00ff00"));
    assert.deepStrictEqual(result, [0, 255, 0, 255]);
  });

  test("clamps out-of-gamut rgb() components", () => {
    const result = getColorAsRGBA("rgb(300, -10, 128)");
    assert.deepStrictEqual(result, [255, 0, 128, 255]);
  });
});

describe("toRGBA", () => {
  test("passes an RGBA object through untouched", () => {
    const rgba = { r: 1, g: 2, b: 3, a: 4 };
    assert.strictEqual(toRGBA(rgba), rgba);
  });

  test("parses a CSS color string into an RGBA object", () => {
    assert.deepStrictEqual(toRGBA("#ff0000"), { r: 255, g: 0, b: 0, a: 255 });
  });

  test("parses a colorjs.io Color instance into an RGBA object", () => {
    assert.deepStrictEqual(toRGBA(new Color("blue")), { r: 0, g: 0, b: 255, a: 255 });
  });
});
