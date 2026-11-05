// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ColorSpace } from "../../src/convert/index.ts";
import type { RGBA } from "../../src/types.ts";

// CONSTANTS
const kBlack: RGBA = { r: 0, g: 0, b: 0, a: 1 };
const kWhite: RGBA = { r: 1, g: 1, b: 1, a: 1 };
const kGray: RGBA = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
const kOrange: RGBA = { r: 1, g: 0.4, b: 0, a: 1 };

describe("ColorSpace.fromRgb / previous", () => {
  test("hsv and okhsv keep the hue on grays and the saturation on black", () => {
    const previous = { h: 140, s: 0.7, v: 0.5, a: 1 };

    for (const space of [ColorSpace.hsv, ColorSpace.okhsv]) {
      const gray = space.fromRgb(kGray, previous);
      assert.equal(gray.h, 140, space.name);
      assert.equal(gray.s, 0, space.name);

      assert.deepEqual(
        space.fromRgb(kBlack, previous),
        { ...previous, v: 0 },
        space.name
      );
    }
  });

  test("hsl and okhsl keep hue and saturation at black and white", () => {
    const previous = { h: 140, s: 0.7, l: 0.5, a: 1 };

    for (const space of [ColorSpace.hsl, ColorSpace.okhsl]) {
      for (const edge of [kBlack, kWhite]) {
        const carried = space.fromRgb(edge, previous);
        assert.equal(carried.h, 140, space.name);
        assert.equal(carried.s, 0.7, space.name);
      }

      const gray = space.fromRgb(kGray, previous);
      assert.equal(gray.h, 140, space.name);
      assert.equal(gray.s, 0, space.name);
    }
  });

  test("hwb and oklch keep the hue on grays", () => {
    assert.equal(ColorSpace.hwb.fromRgb(kGray, { h: 200 }).h, 200);
    assert.equal(ColorSpace.oklch.fromRgb(kGray, { h: 200 }).h, 200);
  });

  test("hsv, hsl and hwb treat a gray with rounding noise as a gray", () => {
    const noisyGray: RGBA = { r: 0.6 + 1e-15, g: 0.6, b: 0.6 - 1e-15, a: 1 };

    for (const space of [ColorSpace.hsv, ColorSpace.hsl]) {
      const gray = space.fromRgb(noisyGray, { h: 200 });
      assert.equal(gray.h, 200, space.name);
      assert.equal(gray.s, 0, space.name);
    }
    assert.equal(ColorSpace.hwb.fromRgb(noisyGray, { h: 200 }).h, 200);
  });

  test("carries only the channels it is given", () => {
    assert.deepEqual(
      ColorSpace.hsv.fromRgb(kBlack, { h: 140 }),
      { h: 140, s: 0, v: 0, a: 1 }
    );
  });

  test("ignores the previous color when every channel is defined", () => {
    const previous = { h: 10, s: 0.1, v: 0.1, a: 0.5 };

    for (const space of [ColorSpace.hsv, ColorSpace.oklch, ColorSpace.hwb]) {
      assert.deepEqual(
        space.fromRgb(kOrange, previous),
        space.fromRgb(kOrange),
        space.name
      );
    }
  });
});
