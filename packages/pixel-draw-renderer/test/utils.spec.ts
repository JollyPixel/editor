// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import { hexToRgb, rgbToHex, getColorAsRGBA, toRGBA, toCssColor } from "../src/utils.ts";

describe("hexToRgb", () => {
  test("converts black correctly", () => {
    const result = hexToRgb("#000000");
    assert.deepStrictEqual(result, { r: 0, g: 0, b: 0 });
  });

  test("converts white correctly", () => {
    const result = hexToRgb("#ffffff");
    assert.deepStrictEqual(result, { r: 255, g: 255, b: 255 });
  });

  test("converts red correctly", () => {
    const result = hexToRgb("#ff0000");
    assert.deepStrictEqual(result, { r: 255, g: 0, b: 0 });
  });

  test("converts a mixed color correctly", () => {
    const result = hexToRgb("#1a2b3c");
    assert.deepStrictEqual(result, { r: 26, g: 43, b: 60 });
  });
});

describe("rgbToHex", () => {
  test("converts black correctly", () => {
    assert.strictEqual(rgbToHex(0, 0, 0), "#000000");
  });

  test("converts white correctly", () => {
    assert.strictEqual(rgbToHex(255, 255, 255), "#ffffff");
  });

  test("converts red correctly", () => {
    assert.strictEqual(rgbToHex(255, 0, 0), "#ff0000");
  });

  test("throws on out-of-range values", () => {
    assert.throws(() => rgbToHex(-1, 0, 0), /must be between 0 and 255/);
    assert.throws(() => rgbToHex(0, 256, 0), /must be between 0 and 255/);
  });

  test("round-trips with hexToRgb", () => {
    const hex = "#4a7bce";
    const { r, g, b } = hexToRgb(hex);
    assert.strictEqual(rgbToHex(r, g, b), hex);
  });
});

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

describe("toCssColor", () => {
  test("returns strings untouched", () => {
    assert.strictEqual(toCssColor("rgb(1, 2, 3)"), "rgb(1, 2, 3)");
  });

  test("serializes a Color instance to a CSS-valid string", () => {
    assert.strictEqual(toCssColor(new Color("#ff0000")), "#f00");
  });
});
