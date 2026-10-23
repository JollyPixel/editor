// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { HSVA } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  applyChannel,
  channelValues
} from "../../src/color/channels.ts";
import { PickerSpace } from "../../src/color/space.ts";

// CONSTANTS
const kOrange: HSVA = {
  h: 24,
  s: 1,
  v: 1,
  a: 1
};

describe("Color.channelValues", () => {
  test("reports bytes, degrees and percentages", () => {
    assert.deepEqual(
      channelValues(kOrange, PickerSpace.hsv),
      {
        r: 255,
        g: 102,
        b: 0,
        h: 24,
        s: 100,
        l: 50,
        okl: 70,
        okc: 0.204,
        okh: 43,
        a: 100
      }
    );
  });

  test("reports white and black lightness", () => {
    const white = channelValues({
      h: 0,
      s: 0,
      v: 1,
      a: 1
    }, PickerSpace.hsv);
    const black = channelValues({
      h: 0,
      s: 0,
      v: 0,
      a: 0.5
    }, PickerSpace.hsv);

    assert.equal(white.l, 100);
    assert.equal(white.s, 0);
    assert.equal(black.l, 0);
    assert.equal(black.a, 50);
  });
});

describe("Color.applyChannel", () => {
  test("writes an RGB byte and keeps the other bytes", () => {
    const next = channelValues(applyChannel(kOrange, "b", 204, PickerSpace.hsv), PickerSpace.hsv);

    assert.equal(next.r, 255);
    assert.equal(next.g, 102);
    assert.equal(next.b, 204);
  });

  test("keeps hue and saturation when an RGB byte reaches black", () => {
    const black = applyChannel(
      {
        h: 120,
        s: 1,
        v: 0.4,
        a: 1
      },
      "g",
      0,
      PickerSpace.hsv
    );

    assert.equal(black.v, 0);
    assert.equal(black.h, 120);
    assert.equal(black.s, 1);
  });

  test("keeps hue when an RGB byte reaches a gray", () => {
    const gray = applyChannel(
      {
        h: 60,
        s: 1,
        v: 1,
        a: 1
      },
      "b",
      255,
      PickerSpace.hsv
    );

    assert.equal(gray.s, 0);
    assert.equal(gray.h, 60);
  });

  test("writes hue without touching saturation or value", () => {
    assert.deepEqual(
      applyChannel(kOrange, "h", 200, PickerSpace.hsv),
      {
        ...kOrange,
        h: 200
      }
    );
  });

  test("writes HSL lightness and saturation", () => {
    const lighter = channelValues(applyChannel(kOrange, "l", 75, PickerSpace.hsv), PickerSpace.hsv);
    const muted = channelValues(applyChannel(kOrange, "s", 50, PickerSpace.hsv), PickerSpace.hsv);

    assert.equal(lighter.l, 75);
    assert.equal(lighter.s, 100);
    assert.equal(lighter.h, 24);
    assert.equal(muted.s, 50);
    assert.equal(muted.l, 50);
  });

  test("restores saturation after a trip through zero lightness", () => {
    const dark = applyChannel(kOrange, "l", 0, PickerSpace.hsv);
    const restored = channelValues(applyChannel(dark, "l", 50, PickerSpace.hsv), PickerSpace.hsv);

    assert.equal(restored.s, 100);
    assert.equal(restored.r, 255);
    assert.equal(restored.g, 102);
  });

  test("writes alpha as a percentage", () => {
    assert.equal(applyChannel(kOrange, "a", 25, PickerSpace.hsv).a, 0.25);
  });

  test("clamps out-of-range values", () => {
    assert.equal(channelValues(applyChannel(kOrange, "b", 999, PickerSpace.hsv), PickerSpace.hsv).b, 255);
    assert.equal(applyChannel(kOrange, "h", -10, PickerSpace.hsv).h, 0);
    assert.equal(applyChannel(kOrange, "a", 150, PickerSpace.hsv).a, 1);
  });
});

describe("Color.applyChannel / oklch channels", () => {
  test("writes OKLCH lightness and keeps an in-gamut hue", () => {
    const muted = {
      h: 24,
      s: 0.4,
      v: 0.8,
      a: 1
    };
    const before = channelValues(muted, PickerSpace.hsv);
    const darker = channelValues(applyChannel(muted, "okl", 50, PickerSpace.hsv), PickerSpace.hsv);

    assert.equal(darker.okl, 50);
    assert.ok(Math.abs(darker.okh - before.okh) <= 1, `okh ${darker.okh}`);
  });

  test("brings an out of gamut chroma back into sRGB", () => {
    const vivid = channelValues(applyChannel(kOrange, "okc", 0.4, PickerSpace.hsv), PickerSpace.hsv);

    assert.ok(vivid.okc < 0.4);
    assert.ok(vivid.r <= 255 && vivid.g >= 0 && vivid.b >= 0);
  });

  test("writes OKLCH hue straight into an OKHSV point, even on a gray", () => {
    const gray = {
      h: 10,
      s: 0,
      v: 0.5,
      a: 1
    };

    assert.equal(applyChannel(gray, "okh", 200, PickerSpace.okhsv).h, 200);
  });
});

describe("Color.channelValues / okhsv", () => {
  test("reports the OKLCH hue of a gray from the point", () => {
    const values = channelValues(
      {
        h: 250,
        s: 0,
        v: 0.5,
        a: 1
      },
      PickerSpace.okhsv
    );

    assert.equal(values.okh, 250);
    assert.equal(values.okc, 0);
    assert.equal(values.r, values.g);
  });

  test("writes RGB bytes through the OKHSV point", () => {
    const point = PickerSpace.okhsv.fromRgb({ r: 1, g: 0.4, b: 0, a: 1 });
    const next = channelValues(applyChannel(point, "b", 204, PickerSpace.okhsv), PickerSpace.okhsv);

    assert.deepEqual([next.r, next.g, next.b], [255, 102, 204]);
  });
});
