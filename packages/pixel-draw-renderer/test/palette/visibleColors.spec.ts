// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { visibleColors } from "#src/palette/visibleColors.ts";

describe("visibleColors", () => {
  test("keeps each visible color once in first-seen order and skips transparent pixels", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      9, 9, 9, 0,
      0, 0, 255, 128,
      255, 0, 0, 255
    ]);

    assert.deepEqual(visibleColors(pixels, 256), [
      { r: 255, g: 0, b: 0, a: 255 },
      { r: 0, g: 0, b: 255, a: 128 }
    ]);
  });

  test("stops at the limit", () => {
    const pixels = new Uint8ClampedArray([
      1, 0, 0, 255,
      2, 0, 0, 255,
      3, 0, 0, 255
    ]);

    assert.deepEqual(visibleColors(pixels, 2).map((color) => color.r), [1, 2]);
  });
});
