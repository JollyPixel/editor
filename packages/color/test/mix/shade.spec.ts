// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { shadeRamp } from "../../src/mix/shade.ts";
import { ColorSpace } from "../../src/convert/index.ts";
import { formatHex } from "../../src/format.ts";
import { parseColor } from "../../src/parse/index.ts";
import type { RGBA } from "../../src/types.ts";

// CONSTANTS
const kGreen = color("#4c9a52");
const kCoolHue = 265;
const kWarmHue = 85;

describe("shadeRamp", () => {
  test("puts the shades, the base color, then the tints in order", () => {
    const ramp = shadeRamp(kGreen, { shades: 2, tints: 4 });

    assert.equal(ramp.length, 7);
    assert.equal(formatHex(ramp[2]), "#4c9a52");
  });

  test("runs from dark to light", () => {
    const lightness = shadeRamp(kGreen).map((entry) => ColorSpace.oklch.fromRgb(entry).l);

    for (let index = 1; index < lightness.length; index++) {
      assert.ok(lightness[index] > lightness[index - 1], `step ${index}`);
    }
  });

  test("turns shades toward blue and tints toward yellow", () => {
    const ramp = shadeRamp(kGreen, { shades: 1, tints: 1, hueShift: 15 });
    const [shade, base, tint] = ramp.map((entry) => ColorSpace.oklch.fromRgb(entry).h);

    assert.ok(hueDistance(shade, kCoolHue) < hueDistance(base, kCoolHue));
    assert.ok(hueDistance(tint, kWarmHue) < hueDistance(base, kWarmHue));
  });

  test("keeps the hue when hueShift is 0", () => {
    const base = ColorSpace.oklch.fromRgb(kGreen).h;

    for (const entry of shadeRamp(kGreen, { hueShift: 0 })) {
      assert.ok(hueDistance(ColorSpace.oklch.fromRgb(entry).h, base) < 4);
    }
  });

  test("keeps grays gray and carries alpha", () => {
    for (const entry of shadeRamp({ ...color("#808080"), a: 0.5 })) {
      const hex = formatHex(entry);

      assert.equal(hex.slice(1, 3), hex.slice(3, 5), hex);
      assert.equal(hex.slice(3, 5), hex.slice(5, 7), hex);
      assert.equal(entry.a, 0.5);
    }
  });

  test("rejects negative or fractional counts", () => {
    assert.throws(() => shadeRamp(kGreen, { shades: -1 }), RangeError);
    assert.throws(() => shadeRamp(kGreen, { tints: 1.5 }), RangeError);
  });
});

function color(
  hex: string
): RGBA {
  const parsed = parseColor(hex);
  assert.ok(parsed);

  return parsed;
}

function hueDistance(
  from: number,
  to: number
): number {
  const delta = Math.abs(from - to) % 360;

  return Math.min(delta, 360 - delta);
}
