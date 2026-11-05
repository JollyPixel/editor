// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Color,
  ColorSpace,
  type RGBA
} from "@jolly-pixel/color";

// Import Internal Dependencies
import { swatchRing } from "../../src/color/swatchRing.ts";

// CONSTANTS
const kOpaqueSwatches = [
  "#ffffff",
  "#000000",
  "#fff27a",
  "#3c5bd6",
  "#123a33",
  "#c2333c",
  "#8a93a3",
  "#777777"
];

function rgba(
  input: string
): RGBA {
  const color = Color.parse(input);
  assert.ok(color !== null);

  return color;
}

function linear(
  channel: number
): number {
  return channel <= 0.04045 ?
    channel / 12.92 :
    ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(
  color: RGBA
): number {
  return (0.2126 * linear(color.r)) + (0.7152 * linear(color.g)) + (0.0722 * linear(color.b));
}

function contrast(
  first: RGBA,
  second: RGBA
): number {
  const a = luminance(first);
  const b = luminance(second);

  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("swatchRing", () => {
  test("keeps at least 3:1 contrast with opaque swatches in both schemes", () => {
    for (const input of kOpaqueSwatches) {
      const swatch = rgba(input);
      const ring = swatchRing(swatch);

      assert.ok(contrast(ring.light, swatch) >= 3, `${input} on light`);
      assert.ok(contrast(ring.dark, swatch) >= 3, `${input} on dark`);
    }
  });

  test("draws a lighter ring in the dark scheme and a darker one in the light scheme", () => {
    const swatch = rgba("#3c5bd6");
    const ring = swatchRing(swatch);

    assert.ok(luminance(ring.dark) > luminance(swatch));
    assert.ok(luminance(ring.light) < luminance(swatch));
  });

  test("falls back to a darker ring on a near-white swatch in the dark scheme", () => {
    const swatch = rgba("#fff27a");

    assert.ok(luminance(swatchRing(swatch).dark) < luminance(swatch));
  });

  test("keeps the hue of a saturated swatch", () => {
    const swatch = rgba("#c2333c");
    const { h } = ColorSpace.oklch.fromRgb(swatch);
    const ring = swatchRing(swatch);

    for (const shade of [ring.light, ring.dark]) {
      const delta = Math.abs(ColorSpace.oklch.fromRgb(shade).h - h);
      assert.ok(Math.min(delta, 360 - delta) < 10);
    }
  });

  test("measures a transparent swatch against the light checkerboard", () => {
    const ring = swatchRing(rgba("rgba(0, 0, 0, 0)"));
    const checker = rgba("#cccccc");

    assert.ok(luminance(ring.dark) < luminance(checker));
    assert.ok(luminance(ring.light) < luminance(checker));
  });
});
