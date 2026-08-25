// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  fromRGBA8,
  hslToRgb,
  hsvToRgb,
  hwbToRgb,
  linearToSrgb,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  srgbToLinear,
  toRGBA8
} from "../src/convert/index.ts";
import type { RGBA } from "../src/types.ts";

// CONSTANTS
const kEpsilon = 1e-6;
const kSamples: RGBA[] = [
  { r: 1, g: 0.4, b: 0, a: 1 },
  { r: 0, g: 0, b: 0, a: 1 },
  { r: 1, g: 1, b: 1, a: 0.5 },
  { r: 0.2, g: 0.2, b: 0.2, a: 1 },
  { r: 0.1, g: 0.9, b: 0.35, a: 0.25 },
  { r: 0.5, g: 0.25, b: 0.75, a: 0 }
];

function assertClose(
  actual: RGBA,
  expected: RGBA,
  label: string
): void {
  for (const channel of ["r", "g", "b", "a"] as const) {
    assert.ok(
      Math.abs(actual[channel] - expected[channel]) < kEpsilon,
      `${label}.${channel}: ${actual[channel]} != ${expected[channel]}`
    );
  }
}

describe("convert / round trips", () => {
  test("rgb to hsv and back", () => {
    for (const sample of kSamples) {
      assertClose(hsvToRgb(rgbToHsv(sample)), sample, "hsv");
    }
  });

  test("rgb to hsl and back", () => {
    for (const sample of kSamples) {
      assertClose(hslToRgb(rgbToHsl(sample)), sample, "hsl");
    }
  });

  test("rgb to hwb and back", () => {
    for (const sample of kSamples) {
      assertClose(hwbToRgb(rgbToHwb(sample)), sample, "hwb");
    }
  });

  test("srgb gamma and back", () => {
    for (const channel of [0, 0.02, 0.04045, 0.5, 1]) {
      assert.ok(
        Math.abs(linearToSrgb(srgbToLinear(channel)) - channel) < kEpsilon
      );
    }
  });
});

describe("convert / known values", () => {
  test("achromatic colors report hue and saturation 0", () => {
    assert.deepEqual(
      rgbToHsv({ r: 0.5, g: 0.5, b: 0.5, a: 1 }),
      { h: 0, s: 0, v: 0.5, a: 1 }
    );
    assert.deepEqual(
      rgbToHsl({ r: 0.5, g: 0.5, b: 0.5, a: 1 }),
      { h: 0, s: 0, l: 0.5, a: 1 }
    );
  });

  test("hwb collapses to gray when whiteness and blackness fill the color", () => {
    assert.deepEqual(
      hwbToRgb({ h: 210, w: 0.5, b: 0.5, a: 1 }),
      { r: 0.5, g: 0.5, b: 0.5, a: 1 }
    );
  });

  test("hue wraps and channels clamp", () => {
    assert.deepEqual(
      hslToRgb({ h: -360, s: 2, l: 0.5, a: 2 }),
      hslToRgb({ h: 0, s: 1, l: 0.5, a: 1 })
    );
  });
});

describe("convert / bytes", () => {
  test("toRGBA8 rounds and clamps", () => {
    assert.deepEqual(
      toRGBA8({ r: 1.5, g: 0.5, b: -0.2, a: 1 }),
      { r: 255, g: 128, b: 0, a: 255 }
    );
  });

  test("fromRGBA8 round trips within one byte", () => {
    for (let value = 0; value <= 255; value++) {
      const color = {
        r: value,
        g: value,
        b: value,
        a: value
      };

      assert.deepEqual(toRGBA8(fromRGBA8(color)), color);
    }
  });
});
