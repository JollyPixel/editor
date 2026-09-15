// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  fromRGBA8,
  hslToHsv,
  hslToRgb,
  hsvToHsl,
  hsvToRgb,
  hwbToRgb,
  linearToSrgb,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  srgbToLinear,
  toRGBA8
} from "../src/convert/index.ts";
import type {
  HSLA,
  HSVA,
  RGBA
} from "../src/types.ts";

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

describe("convert / hsv and hsl", () => {
  function assertChannelsClose(
    actual: HSVA | HSLA,
    expected: HSVA | HSLA,
    label: string
  ): void {
    for (const [channel, value] of Object.entries(expected)) {
      const received = Reflect.get(actual, channel) as number;
      assert.ok(
        Math.abs(received - value) < kEpsilon,
        `${label}.${channel}: ${received} != ${value}`
      );
    }
  }

  test("known values", () => {
    const fixtures: Array<[HSVA, HSLA]> = [
      [{ h: 24, s: 1, v: 1, a: 1 }, { h: 24, s: 1, l: 0.5, a: 1 }],
      [{ h: 210, s: 0.5, v: 1, a: 0.5 }, { h: 210, s: 1, l: 0.75, a: 0.5 }],
      [{ h: 120, s: 0.5, v: 0.5, a: 1 }, { h: 120, s: 1 / 3, l: 0.375, a: 1 }],
      [{ h: 0, s: 0, v: 1, a: 1 }, { h: 0, s: 0, l: 1, a: 1 }],
      [{ h: 300, s: 0, v: 0.4, a: 1 }, { h: 300, s: 0, l: 0.4, a: 1 }]
    ];

    for (const [hsv, hsl] of fixtures) {
      assertChannelsClose(hsvToHsl(hsv), hsl, "hsvToHsl");
      assertChannelsClose(hslToHsv(hsl), hsv, "hslToHsv");
    }
  });

  test("agrees with the rgb conversions", () => {
    for (const sample of kSamples) {
      const hsv = rgbToHsv(sample);
      assertClose(hslToRgb(hsvToHsl(hsv)), hsvToRgb(hsv), "hsv->hsl");

      const hsl = rgbToHsl(sample);
      assertClose(hsvToRgb(hslToHsv(hsl)), hslToRgb(hsl), "hsl->hsv");
    }
  });

  test("keeps hue on grays", () => {
    assert.equal(hsvToHsl({ h: 200, s: 0, v: 0.5, a: 1 }).h, 200);
    assert.equal(hslToHsv({ h: 200, s: 0, l: 0.5, a: 1 }).h, 200);
  });

  test("keeps saturation through the black point", () => {
    const black = hsvToHsl({ h: 24, s: 1, v: 0, a: 1 });
    assert.equal(black.l, 0);
    assert.equal(black.s, 1);
    assert.deepEqual(
      hslToHsv(black),
      { h: 24, s: 1, v: 0, a: 1 }
    );

    assertChannelsClose(
      hslToHsv({ h: 0, s: 0.5, l: 0, a: 1 }),
      { h: 0, s: 2 / 3, v: 0, a: 1 },
      "black"
    );
  });

  test("hue wraps and channels clamp", () => {
    assert.deepEqual(
      hsvToHsl({ h: -90, s: 2, v: 2, a: -1 }),
      hsvToHsl({ h: 270, s: 1, v: 1, a: 0 })
    );
    assert.deepEqual(
      hslToHsv({ h: 450, s: -1, l: 2, a: 3 }),
      hslToHsv({ h: 90, s: 0, l: 1, a: 1 })
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
