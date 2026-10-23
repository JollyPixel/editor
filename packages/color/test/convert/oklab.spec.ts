// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ColorSpace,
  isOklchInGamut
} from "../../src/convert/index.ts";
import type {
  OKLCHA,
  RGBA
} from "../../src/types.ts";

// CONSTANTS
const kByteTolerance = 1 / 510;
const kPrimaries: Array<[RGBA, OKLCHA]> = [
  [
    { r: 1, g: 0, b: 0, a: 1 },
    { l: 0.627955, c: 0.257683, h: 29.2339, a: 1 }
  ],
  [
    { r: 0, g: 1, b: 0, a: 1 },
    { l: 0.866440, c: 0.294827, h: 142.4953, a: 1 }
  ],
  [
    { r: 0, g: 0, b: 1, a: 1 },
    { l: 0.452014, c: 0.313214, h: 264.0520, a: 1 }
  ]
];
const kSamples: RGBA[] = [
  { r: 1, g: 0.4, b: 0, a: 1 },
  { r: 0.2, g: 0.3, b: 0.7, a: 0.5 },
  { r: 0.02, g: 0.01, b: 0.03, a: 1 },
  { r: 0.6, g: 0.8, b: 0.2, a: 1 },
  { r: 0.9, g: 0.1, b: 0.5, a: 0.25 },
  { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  { r: 1, g: 1, b: 1, a: 1 },
  { r: 0, g: 0, b: 0, a: 1 }
];

function assertRgbClose(
  actual: RGBA,
  expected: RGBA,
  label: string
): void {
  for (const channel of ["r", "g", "b", "a"] as const) {
    assert.ok(
      Math.abs(actual[channel] - expected[channel]) <= kByteTolerance,
      `${label}.${channel}: ${actual[channel]} != ${expected[channel]}`
    );
  }
}

function assertInRange(
  color: RGBA
): void {
  for (const channel of ["r", "g", "b"] as const) {
    assert.ok(color[channel] >= 0 && color[channel] <= 1, `${channel}: ${color[channel]}`);
  }
}

describe("convert / oklch", () => {
  test("matches the CSS Color 4 values of the sRGB primaries", () => {
    for (const [rgb, expected] of kPrimaries) {
      const actual = ColorSpace.oklch.fromRgb(rgb);

      assert.ok(Math.abs(actual.l - expected.l) < 1e-4, `l ${actual.l}`);
      assert.ok(Math.abs(actual.c - expected.c) < 1e-4, `c ${actual.c}`);
      assert.ok(Math.abs(actual.h - expected.h) < 1e-2, `h ${actual.h}`);
    }
  });

  test("reports grays with zero chroma and hue", () => {
    assert.deepEqual(
      ColorSpace.oklch.fromRgb({ r: 1, g: 1, b: 1, a: 0.5 }),
      { l: ColorSpace.oklch.fromRgb({ r: 1, g: 1, b: 1, a: 1 }).l, c: 0, h: 0, a: 0.5 }
    );
    assert.equal(ColorSpace.oklch.fromRgb({ r: 0.5, g: 0.5, b: 0.5, a: 1 }).c, 0);
  });

  test("round trips through rgb", () => {
    for (const sample of kSamples) {
      assertRgbClose(ColorSpace.oklch.toRgb(ColorSpace.oklch.fromRgb(sample)), sample, "oklch");
    }
  });

  test("maps out of gamut colors by reducing chroma, keeping lightness and hue", () => {
    const vivid = { l: 0.7, c: 0.4, h: 150, a: 1 };
    assert.equal(isOklchInGamut(vivid), false);

    const mapped = ColorSpace.oklch.toRgb(vivid);
    assertInRange(mapped);

    const back = ColorSpace.oklch.fromRgb(mapped);
    assert.ok(Math.abs(back.l - vivid.l) < 0.02, `l ${back.l}`);
    assert.ok(Math.abs(back.h - vivid.h) < 5, `h ${back.h}`);
    assert.ok(back.c < vivid.c);
  });

  test("returns white and black at the lightness bounds", () => {
    assert.deepEqual(
      ColorSpace.oklch.toRgb({ l: 1.2, c: 0.3, h: 40, a: 1 }),
      { r: 1, g: 1, b: 1, a: 1 }
    );
    assert.deepEqual(
      ColorSpace.oklch.toRgb({ l: 0, c: 0.3, h: 40, a: 1 }),
      { r: 0, g: 0, b: 0, a: 1 }
    );
  });
});

describe("convert / okhsv and okhsl", () => {
  test("puts every sRGB primary and secondary at full saturation", () => {
    const corners: RGBA[] = [
      { r: 1, g: 0, b: 0, a: 1 },
      { r: 0, g: 1, b: 0, a: 1 },
      { r: 0, g: 0, b: 1, a: 1 },
      { r: 1, g: 1, b: 0, a: 1 },
      { r: 0, g: 1, b: 1, a: 1 },
      { r: 1, g: 0, b: 1, a: 1 }
    ];

    for (const corner of corners) {
      const hsv = ColorSpace.okhsv.fromRgb(corner);
      assert.ok(hsv.s > 0.999, `okhsv s ${hsv.s}`);
      assert.ok(hsv.v > 0.999, `okhsv v ${hsv.v}`);
      assert.ok(ColorSpace.okhsl.fromRgb(corner).s > 0.999, "okhsl s");
    }
  });

  test("shares its hue with oklch", () => {
    for (const sample of kSamples.slice(0, 5)) {
      const hue = ColorSpace.oklch.fromRgb(sample).h;
      assert.ok(Math.abs(ColorSpace.okhsv.fromRgb(sample).h - hue) < 1e-9);
      assert.ok(Math.abs(ColorSpace.okhsl.fromRgb(sample).h - hue) < 1e-9);
    }
  });

  test("round trips through rgb", () => {
    for (const sample of kSamples) {
      assertRgbClose(ColorSpace.okhsv.toRgb(ColorSpace.okhsv.fromRgb(sample)), sample, "okhsv");
      assertRgbClose(ColorSpace.okhsl.toRgb(ColorSpace.okhsl.fromRgb(sample)), sample, "okhsl");
    }
  });

  test("stays inside the sRGB gamut across the whole picker surface", () => {
    for (let h = 0; h < 360; h += 15) {
      for (const s of [0, 0.5, 1]) {
        for (const v of [0.1, 0.5, 1]) {
          assertInRange(ColorSpace.okhsv.toRgb({ h, s, v, a: 1 }));
          assertInRange(ColorSpace.okhsl.toRgb({ h, s, l: v, a: 1 }));
        }
      }
    }
  });

  test("grays keep zero saturation and a lightness that follows the toe", () => {
    const gray = ColorSpace.okhsv.fromRgb({ r: 0.5, g: 0.5, b: 0.5, a: 1 });
    assert.equal(gray.s, 0);
    assert.equal(gray.h, 0);
    assert.equal(ColorSpace.okhsl.fromRgb({ r: 0.5, g: 0.5, b: 0.5, a: 1 }).l, gray.v);
    assert.equal(ColorSpace.okhsv.fromRgb({ r: 0, g: 0, b: 0, a: 1 }).v, 0);
    assert.ok(Math.abs(ColorSpace.okhsv.fromRgb({ r: 1, g: 1, b: 1, a: 1 }).v - 1) < 1e-6);
  });
});
