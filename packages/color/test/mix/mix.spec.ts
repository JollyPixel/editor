// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  colorRamp,
  mixColor,
  type MixSpace
} from "../../src/mix/mix.ts";
import {
  ColorSpace,
  type HueInterpolation
} from "../../src/convert/index.ts";
import { formatHex } from "../../src/format.ts";
import type { RGBA } from "../../src/types.ts";

// CONSTANTS
const kSpaces: MixSpace[] = [
  "srgb",
  "linear",
  "oklab",
  "hsv",
  "okhsv",
  "hsl",
  "okhsl",
  "hwb",
  "oklch"
];
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const kWhite: RGBA = { r: 1, g: 1, b: 1, a: 1 };
const kGray: RGBA = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
const kCyan: RGBA = { r: 0, g: 1, b: 1, a: 1 };
const kRed: RGBA = { r: 1, g: 0, b: 0, a: 1 };
const kBlue: RGBA = { r: 0, g: 0, b: 1, a: 1 };

describe("mixColor", () => {
  test("returns the endpoints at amounts 0 and 1 in every space", () => {
    for (const space of kSpaces) {
      assert.equal(formatHex(mixColor(kRed, kBlue, 0, { space })), "#ff0000", space);
      assert.equal(formatHex(mixColor(kRed, kBlue, 1, { space })), "#0000ff", space);
    }
  });

  test("interpolates alpha linearly", () => {
    const mixed = mixColor(
      { ...kRed, a: 0 },
      kBlue,
      0.25
    );

    assert.equal(mixed.a, 0.25);
  });

  test("blends black and white differently per space", () => {
    function mid(
      space: MixSpace
    ): string {
      return formatHex(mixColor(kBlack, kWhite, 0.5, { space }));
    }

    assert.equal(mid("srgb"), "#808080");
    assert.equal(mid("linear"), "#bcbcbc");
    assert.equal(mid("oklab"), "#636363");
    assert.equal(mid("hsl"), "#808080");
  });

  test("keeps the hue of the chromatic side when one end is gray", () => {
    const mixed = mixColor(kGray, kCyan, 0.5, { space: "oklch" });

    assert.ok(mixed.r < mixed.g && mixed.r < mixed.b, formatHex(mixed));
    assert.ok(
      Math.abs(
        ColorSpace.oklch.fromRgb(mixed).h - ColorSpace.oklch.fromRgb(kCyan).h
      ) < 1,
      "hue follows cyan"
    );
  });

  test("carries only the hue of a gray end, like CSS color-mix", () => {
    assert.equal(
      formatHex(mixColor(kBlack, kRed, 0.5, { space: "hsl" })),
      "#602020"
    );
  });

  test("follows the requested hue arc", () => {
    function hueAt(
      hue: HueInterpolation
    ): number {
      return ColorSpace.oklch.fromRgb(
        mixColor(kRed, kBlue, 0.5, { space: "oklch", hue })
      ).h;
    }

    const shorter = hueAt("shorter");
    const longer = hueAt("longer");
    assert.ok(shorter > 264 || shorter < 29, `shorter ${shorter}`);
    assert.ok(longer > 29 && longer < 264, `longer ${longer}`);
  });
});

describe("colorRamp", () => {
  test("includes both endpoints and the requested count", () => {
    const ramp = colorRamp(kBlack, kWhite, 5, { space: "srgb" });

    assert.deepEqual(
      ramp.map((color) => formatHex(color)),
      ["#000000", "#404040", "#808080", "#bfbfbf", "#ffffff"]
    );
  });

  test("rejects counts below two", () => {
    assert.throws(() => colorRamp(kBlack, kWhite, 1), RangeError);
    assert.throws(() => colorRamp(kBlack, kWhite, 2.5), RangeError);
  });
});
