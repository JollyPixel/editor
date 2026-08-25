// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { parseColor } from "../../src/parse/index.ts";
import { formatHex } from "../../src/format.ts";
import { rgbToHsl } from "../../src/convert/hsl.ts";

// CONSTANTS
// hsl(210 40% 17%) is the same color in every notation below.
const kHex = "#1a2b3d";
const kHslFixtures: [string, string][] = [
  ["hsl(210, 40%, 17%)", kHex],
  ["hsl(210 40% 17%)", kHex],
  ["hsla(210, 40%, 17%)", kHex],
  ["HSL(210,40%,17%)", kHex],
  ["hsl(210 40 17)", kHex],
  ["hsl(210deg 40% 17%)", kHex],
  ["hsl(3.665191429188092rad 40% 17%)", kHex],
  ["hsl(0.5833333333333334turn 40% 17%)", kHex],
  ["hsl(233.33333333333334grad 40% 17%)", kHex]
];
const kAlphaFixtures: [string, number][] = [
  ["hsla(210, 40%, 17%, 0.5)", 0.5],
  ["hsl(210 40% 17% / 50%)", 0.5],
  ["hsva(210 40% 17% / 0.5)", 0.5],
  ["hwb(210 40% 17% / 0.5)", 0.5]
];
const kRejected = [
  "hwb(210, 40%, 17%)",
  "hwba(210 40% 17%)",
  "hsl(210, 40%)",
  "hsl(red, 40%, 17%)",
  "hsl(210px, 40%, 17%)",
  "hsl(210, 40%, 17%, 1, 1)"
];

function hueOf(
  input: string
): number {
  const color = parseColor(input);
  if (color === null) {
    assert.fail(`${input} did not parse`);
  }

  return rgbToHsl(color).h;
}

describe("parseColor / hsl", () => {
  for (const [input, expected] of kHslFixtures) {
    test(`parses '${input}'`, () => {
      const color = parseColor(input);
      if (color === null) {
        assert.fail(`${input} did not parse`);
      }

      assert.equal(formatHex(color), expected);
    });
  }

  test("reads every angle unit as the same hue", () => {
    for (const [input] of kHslFixtures) {
      assert.ok(
        Math.abs(hueOf(input) - 210) < 1e-9,
        `${input}: ${hueOf(input)}`
      );
    }
  });

  test("wraps the hue into 0-360", () => {
    assert.equal(hueOf("hsl(-150, 40%, 17%)"), 210);
    assert.equal(hueOf("hsl(570, 40%, 17%)"), 210);
  });

  test("clamps saturation and lightness", () => {
    const color = parseColor("hsl(210, 140%, -10%)");
    if (color === null) {
      assert.fail("did not parse");
    }

    assert.deepEqual(color, {
      r: 0,
      g: 0,
      b: 0,
      a: 1
    });
  });
});

describe("parseColor / hsv and hwb", () => {
  test("hsv() and hsl() disagree, as their models do", () => {
    assert.equal(formatHex(parseColor("hsv(210, 40%, 17%)")!), "#1a232b");
    assert.equal(formatHex(parseColor("hsl(210, 40%, 17%)")!), kHex);
  });

  test("hwb() mixes whiteness and blackness into the hue", () => {
    assert.equal(formatHex(parseColor("hwb(210 40% 17%)")!), "#669dd4");
  });

  test("hwb() collapses to gray once w + b reaches 1", () => {
    assert.equal(formatHex(parseColor("hwb(210 50% 50%)")!), "#808080");
  });

  test("carries alpha through every notation", () => {
    for (const [input, expected] of kAlphaFixtures) {
      const color = parseColor(input);
      if (color === null) {
        assert.fail(`${input} did not parse`);
      }

      assert.equal(color.a, expected, input);
    }
  });

  test("rejects malformed input, hwb's comma form included", () => {
    for (const input of kRejected) {
      assert.equal(parseColor(input), null, input);
    }
  });
});
