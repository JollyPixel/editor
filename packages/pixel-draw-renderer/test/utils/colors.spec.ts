// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import {
  colorAsRGBA,
  contrastingColor,
  rgbToHex,
  toRGBA
} from "#src/utils/colors.ts";

describe("colorAsRGBA", () => {
  test("returns opaque white for #ffffff", () => {
    const [r, g, b, a] = colorAsRGBA("#ffffff");
    assert.strictEqual(r, 255);
    assert.strictEqual(g, 255);
    assert.strictEqual(b, 255);
    assert.strictEqual(a, 255);
  });

  test("returns opaque black for #000000", () => {
    const [r, g, b, a] = colorAsRGBA("#000000");
    assert.strictEqual(r, 0);
    assert.strictEqual(g, 0);
    assert.strictEqual(b, 0);
    assert.strictEqual(a, 255);
  });

  test("returns four components", () => {
    const result = colorAsRGBA("#ff0000");
    assert.strictEqual(result.length, 4);
  });

  test("reads explicit alpha from #rrggbbaa", () => {
    const result = colorAsRGBA("#ff000080");
    assert.deepStrictEqual(result, [255, 0, 0, 128]);
  });

  test("expands #rgb shorthand", () => {
    const result = colorAsRGBA("#0f0");
    assert.deepStrictEqual(result, [0, 255, 0, 255]);
  });

  test("expands #rgba shorthand", () => {
    const result = colorAsRGBA("#0f08");
    assert.deepStrictEqual(result, [0, 255, 0, 136]);
  });

  test("accepts a named CSS color", () => {
    const result = colorAsRGBA("red");
    assert.deepStrictEqual(result, [255, 0, 0, 255]);
  });

  test("accepts an rgb() string", () => {
    const result = colorAsRGBA("rgb(0, 0, 255)");
    assert.deepStrictEqual(result, [0, 0, 255, 255]);
  });

  test("accepts an hsl() string with alpha", () => {
    const result = colorAsRGBA("hsl(0 100% 50% / 0.5)");
    assert.deepStrictEqual(result, [255, 0, 0, 128]);
  });

  test("accepts a colorjs.io Color instance", () => {
    const result = colorAsRGBA(new Color("#00ff00"));
    assert.deepStrictEqual(result, [0, 255, 0, 255]);
  });

  test("clamps out-of-gamut rgb() components", () => {
    const result = colorAsRGBA("rgb(300, -10, 128)");
    assert.deepStrictEqual(result, [255, 0, 128, 255]);
  });
});

describe("toRGBA", () => {
  test("passes an RGBA object through untouched", () => {
    const rgba = { r: 1, g: 2, b: 3, a: 4 };
    assert.strictEqual(toRGBA(rgba), rgba);
  });

  test("parses a CSS color string into an RGBA object", () => {
    assert.deepStrictEqual(
      toRGBA("#ff0000"),
      { r: 255, g: 0, b: 0, a: 255 }
    );
  });

  test("parses a colorjs.io Color instance into an RGBA object", () => {
    assert.deepStrictEqual(
      toRGBA(new Color("blue")),
      { r: 0, g: 0, b: 255, a: 255 }
    );
  });
});

describe("contrastingColor", () => {
  test("returns black on white and white on black", () => {
    assert.strictEqual(contrastingColor("#ffffff"), "#000");
    assert.strictEqual(contrastingColor("#000000"), "#FFF");
  });

  test("weights green above red and blue at equal component values", () => {
    // Pure green reads far brighter than pure blue, so they must not share a
    // verdict just because both are fully saturated.
    assert.strictEqual(contrastingColor("#00ff00"), "#000");
    assert.strictEqual(contrastingColor("#0000ff"), "#FFF");
  });

  test("returns white for mid-gray", () => {
    assert.strictEqual(contrastingColor("rgb(128, 128, 128)"), "#FFF");
  });

  test("accepts any CSS color notation", () => {
    assert.strictEqual(contrastingColor("red"), "#FFF");
    assert.strictEqual(contrastingColor("hsl(60 100% 50%)"), "#000");
  });

  test("ignores alpha", () => {
    assert.strictEqual(
      contrastingColor("#ffffff00"),
      contrastingColor("#ffffff")
    );
  });
});

describe("rgbToHex", () => {
  test("formats white", () => {
    assert.strictEqual(
      rgbToHex(255, 255, 255),
      "#ffffff"
    );
  });

  test("formats black", () => {
    assert.strictEqual(
      rgbToHex(0, 0, 0),
      "#000000"
    );
  });

  test("zero-pads components that would otherwise be short", () => {
    assert.strictEqual(
      rgbToHex(0, 15, 5),
      "#000f05"
    );
  });

  test("round-trips with colorAsRGBA", () => {
    const [r, g, b] = colorAsRGBA("#1a2b3c");
    assert.strictEqual(
      rgbToHex(r, g, b),
      "#1a2b3c"
    );
  });
});
