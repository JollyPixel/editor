// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  hsvToRgb,
  rgbToHsv
} from "../../src/color/hsv.ts";
import { formatHex } from "../../src/color/format.ts";
import { parseColor } from "../../src/color/parse.ts";
import type { HSVA } from "../../src/color/types.ts";

// CONSTANTS
const kPrimaries: [string, number][] = [
  ["#ff0000", 0],
  ["#ffff00", 60],
  ["#00ff00", 120],
  ["#00ffff", 180],
  ["#0000ff", 240],
  ["#ff00ff", 300]
];

function hexOf(
  color: HSVA
): string {
  return formatHex(hsvToRgb(color));
}

function hsvOf(
  hex: string
): HSVA {
  const parsed = parseColor(hex);
  if (parsed === null) {
    assert.fail(`${hex} did not parse`);
  }

  return rgbToHsv(parsed);
}

describe("Color.rgbToHsv", () => {
  test("places each primary and secondary on its hue sector", () => {
    for (const [hex, hue] of kPrimaries) {
      const { h, s, v } = hsvOf(hex);

      assert.equal(h, hue, hex);
      assert.equal(s, 1, hex);
      assert.equal(v, 1, hex);
    }
  });

  test("reports greys as unsaturated with no hue", () => {
    const grey = hsvOf("#808080");

    assert.equal(grey.h, 0);
    assert.equal(grey.s, 0);
  });

  test("reports black with a zero value and no saturation", () => {
    const black = hsvOf("#000000");

    assert.equal(black.s, 0);
    assert.equal(black.v, 0);
  });

  test("carries alpha through untouched", () => {
    assert.equal(
      hsvOf("#ff660080").a,
      128 / 255
    );
  });
});

describe("Color.hsvToRgb", () => {
  test("reproduces each primary and secondary", () => {
    for (const [hex, hue] of kPrimaries) {
      assert.equal(
        hexOf({
          h: hue,
          s: 1,
          v: 1,
          a: 1
        }),
        hex
      );
    }
  });

  test("wraps hue, so 360 and negative angles name existing sectors", () => {
    const red = {
      h: 360,
      s: 1,
      v: 1,
      a: 1
    };

    assert.equal(
      hexOf(red),
      "#ff0000"
    );
    // -120 wraps to 240, which is blue.
    assert.equal(
      hexOf({
        ...red,
        h: -120
      }),
      "#0000ff"
    );
    assert.equal(
      hexOf({
        ...red,
        h: -240
      }),
      "#00ff00"
    );
  });

  test("clamps saturation, value and alpha to their unit range", () => {
    assert.equal(
      hexOf({
        h: 0,
        s: 4,
        v: 9,
        a: 1
      }),
      "#ff0000"
    );
    assert.equal(
      hexOf({
        h: 0,
        s: -1,
        v: -1,
        a: 1
      }),
      "#000000"
    );
  });

  test("keeps hue and saturation that hex cannot express", () => {
    // Both colours are black. Only HSVA preserves the cursor hue.
    const shadowed: HSVA = {
      h: 210,
      s: 0.8,
      v: 0,
      a: 1
    };

    assert.equal(
      hexOf(shadowed),
      "#000000"
    );
    assert.equal(
      hsvOf("#000000").h,
      0
    );
  });
});

describe("Color hsv round trip", () => {
  test("returns the original hex for a sweep of colours", () => {
    const samples = [
      "#ff6600",
      "#123456",
      "#0a0b0c",
      "#fefefe",
      "#00ff88",
      "#7f3fbf"
    ];

    for (const hex of samples) {
      assert.equal(
        hexOf(hsvOf(hex)),
        hex
      );
    }
  });
});
