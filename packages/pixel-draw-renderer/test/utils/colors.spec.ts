// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ColorParseError } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  resolveColor,
  toCssColor
} from "#src/utils/colors.ts";

describe("resolveColor", () => {
  test("parses a CSS color string into byte channels", () => {
    assert.deepStrictEqual(
      resolveColor("#ff0000"),
      {
        r: 255,
        g: 0,
        b: 0,
        a: 255
      }
    );
  });

  test("reads the alpha pair of an eight digit hex", () => {
    assert.deepStrictEqual(
      resolveColor("#ff000080"),
      {
        r: 255,
        g: 0,
        b: 0,
        a: 128
      }
    );
  });

  test("accepts every notation the parser does", () => {
    const red = {
      r: 255,
      g: 0,
      b: 0,
      a: 255
    };

    for (const input of ["red", "#f00", "rgb(255, 0, 0)", "hsl(0 100% 50%)"]) {
      assert.deepStrictEqual(resolveColor(input), red, input);
    }
  });

  test("clamps out-of-gamut channels", () => {
    assert.deepStrictEqual(
      resolveColor("rgb(300, -10, 128)"),
      {
        r: 255,
        g: 0,
        b: 128,
        a: 255
      }
    );
  });

  test("passes byte channels through untouched", () => {
    const rgba = {
      r: 1,
      g: 2,
      b: 3,
      a: 4
    };

    assert.strictEqual(resolveColor(rgba), rgba);
  });

  test("throws on an unparseable string", () => {
    assert.throws(
      () => resolveColor("not-a-color"),
      ColorParseError
    );
  });
});

describe("toCssColor", () => {
  test("normalizes a string to a canvas-ready rgba()", () => {
    assert.strictEqual(
      toCssColor("#ff000080"),
      "rgba(255, 0, 0, 0.502)"
    );
  });

  test("normalizes byte channels the same way", () => {
    assert.strictEqual(
      toCssColor({
        r: 255,
        g: 102,
        b: 0,
        a: 255
      }),
      "rgba(255, 102, 0, 1)"
    );
  });
});
