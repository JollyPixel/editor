// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Color } from "../../src/Color.ts";
import { ColorSpace } from "../../src/convert/ColorSpace.ts";
import { HueSpace } from "../../src/convert/HueSpace.ts";
import type { HSVA } from "../../src/types.ts";

// CONSTANTS
const kOrange: HSVA = {
  h: 24,
  s: 1,
  v: 1,
  a: 1
};

function hex(
  space: HueSpace,
  point: HSVA
): string {
  return new Color(space.toRgb(point)).hex();
}

describe("HueSpace.convert", () => {
  test("keeps the color and the hue of a gray", () => {
    const orange = HueSpace.hsv.fromRgb({ r: 1, g: 0.4, b: 0, a: 1 });
    const gray = {
      h: 75,
      s: 0,
      v: 0.5,
      a: 1
    };

    assert.equal(hex(HueSpace.okhsv, HueSpace.hsv.convert(orange, HueSpace.okhsv)), "#ff6600");
    assert.equal(HueSpace.hsv.convert(gray, HueSpace.okhsv).h, 75);
    assert.equal(HueSpace.hsv.convert(gray, HueSpace.okhsl).h, 75);
  });
});

describe("HueSpace.okhsl", () => {
  test("puts lightness on the level axis and its pure hues at half lightness", () => {
    const space = HueSpace.named("okhsl");
    const point = space.fromRgb({ r: 0.2, g: 0.6, b: 0.55, a: 1 });

    assert.equal(space.level, "lightness");
    assert.equal(hex(space, point), "#33998c");
    assert.equal(hex(space, { ...point, v: 1 }), "#ffffff");
    assert.notEqual(new Color(space.pureHue(point)).hex(), "#ffffff");
  });
});

describe("HueSpace.read and HueSpace.write", () => {
  test("read gives the HSL coordinates of an HSV point", () => {
    assert.deepEqual(
      HueSpace.hsv.read(kOrange, ColorSpace.hsl),
      { h: 24, s: 1, l: 0.5, a: 1 }
    );
  });

  test("writing hue in a space that shares it leaves saturation and level alone", () => {
    assert.deepEqual(
      HueSpace.hsv.write(kOrange, ColorSpace.hsl, "h", 200),
      {
        ...kOrange,
        h: 200
      }
    );
  });

  test("restores HSL saturation after a trip through zero lightness", () => {
    const dark = HueSpace.hsv.write(kOrange, ColorSpace.hsl, "l", 0);
    const restored = HueSpace.hsv.write(dark, ColorSpace.hsl, "l", 0.5);

    assert.equal(hex(HueSpace.hsv, restored), "#ff6600");
  });

  test("reads and writes OKLCH hue straight through an OKHSV gray", () => {
    const gray = {
      h: 250,
      s: 0,
      v: 0.5,
      a: 1
    };

    assert.equal(HueSpace.okhsv.read(gray, ColorSpace.oklch).h, 250);
    assert.equal(HueSpace.okhsv.write(gray, ColorSpace.oklch, "h", 200).h, 200);
  });

  test("writes OKLCH lightness from an HSV point and keeps an in-gamut hue", () => {
    const muted = {
      h: 24,
      s: 0.4,
      v: 0.8,
      a: 1
    };
    const before = HueSpace.hsv.read(muted, ColorSpace.oklch);
    const darker = HueSpace.hsv.read(
      HueSpace.hsv.write(muted, ColorSpace.oklch, "l", 0.5),
      ColorSpace.oklch
    );

    assert.ok(Math.abs(darker.l - 0.5) < 0.005, `l ${darker.l}`);
    assert.ok(Math.abs(darker.h - before.h) <= 1, `h ${darker.h}`);
  });

  test("brings an out of gamut chroma back into sRGB", () => {
    const vivid = HueSpace.hsv.read(
      HueSpace.hsv.write(kOrange, ColorSpace.oklch, "c", 0.4),
      ColorSpace.oklch
    );

    assert.ok(vivid.c < 0.4);
  });
});
