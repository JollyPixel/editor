// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  HueSpace,
  type HSVA
} from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  applyChannel,
  channelValues
} from "../../src/color/channels.ts";

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
      channelValues(kOrange, HueSpace.hsv),
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
    }, HueSpace.hsv);
    const black = channelValues({
      h: 0,
      s: 0,
      v: 0,
      a: 0.5
    }, HueSpace.hsv);

    assert.equal(white.l, 100);
    assert.equal(white.s, 0);
    assert.equal(black.l, 0);
    assert.equal(black.a, 50);
  });
});

describe("Color.applyChannel", () => {
  test("writes an RGB byte and keeps the other bytes", () => {
    const next = channelValues(applyChannel(kOrange, "b", 204, HueSpace.hsv), HueSpace.hsv);

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
      HueSpace.hsv
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
      HueSpace.hsv
    );

    assert.equal(gray.s, 0);
    assert.equal(gray.h, 60);
  });

  test("writes HSL lightness and saturation", () => {
    const lighter = channelValues(applyChannel(kOrange, "l", 75, HueSpace.hsv), HueSpace.hsv);
    const muted = channelValues(applyChannel(kOrange, "s", 50, HueSpace.hsv), HueSpace.hsv);

    assert.equal(lighter.l, 75);
    assert.equal(lighter.s, 100);
    assert.equal(lighter.h, 24);
    assert.equal(muted.s, 50);
    assert.equal(muted.l, 50);
  });

  test("writes alpha as a percentage", () => {
    assert.equal(applyChannel(kOrange, "a", 25, HueSpace.hsv).a, 0.25);
  });

  test("clamps out-of-range values", () => {
    assert.equal(channelValues(applyChannel(kOrange, "b", 999, HueSpace.hsv), HueSpace.hsv).b, 255);
    assert.equal(applyChannel(kOrange, "h", -10, HueSpace.hsv).h, 0);
    assert.equal(applyChannel(kOrange, "a", 150, HueSpace.hsv).a, 1);
  });
});

describe("Color.applyChannel / okhsv", () => {
  test("writes RGB bytes through the OKHSV point", () => {
    const point = HueSpace.okhsv.fromRgb({ r: 1, g: 0.4, b: 0, a: 1 });
    const next = channelValues(applyChannel(point, "b", 204, HueSpace.okhsv), HueSpace.okhsv);

    assert.deepEqual([next.r, next.g, next.b], [255, 102, 204]);
  });
});
