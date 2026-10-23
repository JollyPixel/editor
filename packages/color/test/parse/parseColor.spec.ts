// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  assertColor,
  assertColor8,
  ColorParseError,
  parseColor
} from "../../src/parse/index.ts";
import { formatHex } from "../../src/format.ts";

// CONSTANTS
const kEquivalent = [
  "#ff6600",
  "rgb(255, 102, 0)",
  "rgb(100% 40% 0%)",
  "hsl(24, 100%, 50%)",
  "hsv(24, 100%, 100%)",
  "hwb(24 0% 0%)"
];
const kRejected = [
  "",
  "   ",
  "#",
  "not-a-color",
  "lab(50% 40 59)",
  "color(display-p3 1 0 0)",
  "rgb(1,2,3)extra"
];

describe("parseColor", () => {
  test("every notation of the same color agrees", () => {
    for (const input of kEquivalent) {
      const color = parseColor(input);
      if (color === null) {
        assert.fail(`${input} did not parse`);
      }

      assert.equal(formatHex(color), "#ff6600", input);
    }
  });

  test("returns null for unrecognised input", () => {
    for (const input of kRejected) {
      assert.equal(parseColor(input), null, input);
    }
  });
});

describe("assertColor", () => {
  test("passes an already parsed color straight through", () => {
    const color = {
      r: 0.5,
      g: 0.25,
      b: 0,
      a: 1
    };

    assert.equal(assertColor(color), color);
  });

  test("throws ColorParseError on unrecognised input", () => {
    assert.throws(
      () => assertColor("not-a-color"),
      (error: Error) => {
        assert.ok(error instanceof ColorParseError);
        assert.equal(error.name, "ColorParseError");
        assert.match(error.message, /not-a-color/);

        return true;
      }
    );
  });
});

describe("assertColor8", () => {
  test("parses a string into rounded, clamped byte channels", () => {
    assert.deepEqual(
      assertColor8("#ff000080"),
      { r: 255, g: 0, b: 0, a: 128 }
    );
    assert.deepEqual(
      assertColor8("rgb(300, -10, 128)"),
      { r: 255, g: 0, b: 128, a: 255 }
    );
  });

  test("passes byte channels straight through", () => {
    const color = {
      r: 1,
      g: 2,
      b: 3,
      a: 4
    };

    assert.equal(assertColor8(color), color);
  });

  test("throws ColorParseError on unrecognised input", () => {
    assert.throws(() => assertColor8("not-a-color"), ColorParseError);
  });
});
