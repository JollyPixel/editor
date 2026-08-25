// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  assertColor,
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

  test("returns unit channels", () => {
    assert.deepEqual(
      parseColor("#ffffff80"),
      {
        r: 1,
        g: 1,
        b: 1,
        a: 128 / 255
      }
    );
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
