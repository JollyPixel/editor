// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Gradient,
  type MixSpace
} from "../../src/mix/Gradient.ts";
import { ColorSpace } from "../../src/convert/index.ts";
import type { HueInterpolation } from "../../src/hue.ts";
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

describe("Gradient.at", () => {
  test("returns the endpoints at amounts 0 and 1 in every space", () => {
    for (const space of kSpaces) {
      assert.equal(Gradient.between(kRed, kBlue, { space }).at(0).hex(), "#ff0000", space);
      assert.equal(Gradient.between(kRed, kBlue, { space }).at(1).hex(), "#0000ff", space);
    }
  });

  test("interpolates alpha linearly", () => {
    const mixed = Gradient.between({ ...kRed, a: 0 }, kBlue).at(0.25);

    assert.equal(mixed.a, 0.25);
  });

  test("blends black and white differently per space", () => {
    function mid(
      space: MixSpace
    ): string {
      return Gradient.between(kBlack, kWhite, { space }).at(0.5).hex();
    }

    assert.equal(mid("srgb"), "#808080");
    assert.equal(mid("linear"), "#bcbcbc");
    assert.equal(mid("oklab"), "#636363");
    assert.equal(mid("hsl"), "#808080");
  });

  test("keeps the hue of the chromatic side when one end is gray", () => {
    const mixed = Gradient.between(kGray, kCyan, { space: "oklch" }).at(0.5);

    assert.ok(mixed.r < mixed.g && mixed.r < mixed.b, mixed.hex());
    assert.ok(
      Math.abs(
        ColorSpace.oklch.fromRgb(mixed).h - ColorSpace.oklch.fromRgb(kCyan).h
      ) < 1,
      "hue follows cyan"
    );
  });

  test("carries only the hue of a gray end, like CSS color-mix", () => {
    assert.equal(
      Gradient.between(kBlack, kRed, { space: "hsl" }).at(0.5).hex(),
      "#602020"
    );
  });

  test("follows the requested hue arc", () => {
    function hueAt(
      hue: HueInterpolation
    ): number {
      return ColorSpace.oklch.fromRgb(
        Gradient.between(kRed, kBlue, { space: "oklch", hue }).at(0.5)
      ).h;
    }

    const shorter = hueAt("shorter");
    const longer = hueAt("longer");
    assert.ok(shorter > 264 || shorter < 29, `shorter ${shorter}`);
    assert.ok(longer > 29 && longer < 264, `longer ${longer}`);
  });
});

describe("Gradient.steps", () => {
  test("includes both endpoints and the requested count", () => {
    const ramp = Gradient.between(kBlack, kWhite, { space: "srgb" }).steps(5);

    assert.deepEqual(
      ramp.map((color) => color.hex()),
      ["#000000", "#404040", "#808080", "#bfbfbf", "#ffffff"]
    );
  });

  test("rejects step counts below two", () => {
    assert.throws(() => Gradient.between(kBlack, kWhite).steps(1), RangeError);
    assert.throws(() => Gradient.between(kBlack, kWhite).steps(2.5), RangeError);
  });
});
