// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  colorHarmony,
  HARMONY_KINDS
} from "../../src/mix/harmony.ts";
import type { HSVA } from "../../src/types.ts";

// CONSTANTS
const kBase: HSVA = {
  h: 300,
  s: 0.8,
  v: 0.6,
  a: 0.5
};

describe("colorHarmony", () => {
  test("starts every scheme with the base color", () => {
    for (const kind of HARMONY_KINDS) {
      assert.deepEqual(colorHarmony(kBase, kind)[0], kBase, kind);
    }
  });

  test("rotates and wraps the hue, keeping the other channels", () => {
    assert.deepEqual(
      colorHarmony(kBase, "triadic").map((color) => color.h),
      [300, 60, 180]
    );
    assert.deepEqual(
      colorHarmony(kBase, "analogous").map((color) => color.h),
      [300, 270, 330]
    );
    for (const color of colorHarmony(kBase, "square")) {
      assert.equal(color.s, kBase.s);
      assert.equal(color.v, kBase.v);
      assert.equal(color.a, kBase.a);
    }
  });

  test("monochromatic keeps the hue and darkens or desaturates", () => {
    const [, shade, tint] = colorHarmony(kBase, "monochromatic");

    assert.deepEqual(shade, { ...kBase, v: 0.3 });
    assert.deepEqual(tint, { ...kBase, s: 0.4 });
  });
});
