// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  COLOR_PALETTE_MAX_SIZE,
  ColorPalette
} from "#src/palette/ColorPalette.ts";
import type { RGBA8 } from "#src/types.ts";

// CONSTANTS
const kA = gray(10);
const kB = gray(20);
const kC = gray(30);
const kD = gray(40);

describe("ColorPalette", () => {
  test("parses 1 to 256 colors and nothing else", () => {
    assert.equal(ColorPalette.parse([kA])?.size, 1);
    assert.equal(ColorPalette.parse(Array.from({ length: COLOR_PALETTE_MAX_SIZE }, () => kA))?.size, 256);
    assert.equal(ColorPalette.parse([]), null);
    assert.equal(ColorPalette.parse(Array.from({ length: 257 }, () => kA)), null);
  });

  test("inserts colors and refuses to grow past 256", () => {
    const palette = ColorPalette.from([kA, kB]);

    assert.deepEqual(palette.withInserted(1, [kC, kD]).toJSON(), [kA, kC, kD, kB]);
    assert.deepEqual(palette.withInserted(2, [kC]).toJSON(), [kA, kB, kC]);
    assert.throws(() => palette.withInserted(3, [kC]), RangeError);
    const full = ColorPalette.from(Array.from({ length: COLOR_PALETTE_MAX_SIZE }, () => kA));
    assert.throws(() => full.withInserted(0, [kB]), RangeError);
  });

  test("removes a run but keeps at least one color", () => {
    const palette = ColorPalette.from([kA, kB, kC]);

    assert.deepEqual(palette.withRemoved(0, 2).toJSON(), [kC]);
    assert.throws(() => palette.withRemoved(0, 3), RangeError);
    assert.throws(() => palette.withRemoved(2, 2), RangeError);
  });

  test("moves a run to an index of the result", () => {
    const palette = ColorPalette.from([kA, kB, kC, kD]);

    assert.deepEqual(palette.withMoved(0, 2, 2).toJSON(), [kC, kD, kA, kB]);
    assert.deepEqual(palette.withMoved(3, 1, 0).toJSON(), [kD, kA, kB, kC]);
    assert.throws(() => palette.withMoved(0, 2, 3), RangeError);
  });

  test("replaces a run that fits and returns itself when nothing changes", () => {
    const palette = ColorPalette.from([kA, kB, kC]);

    assert.deepEqual(palette.withColors(1, [kD, kD]).toJSON(), [kA, kD, kD]);
    assert.throws(() => palette.withColors(2, [kD, kD]), RangeError);
    assert.equal(palette.withColors(0, [kA, kB]), palette);
    assert.equal(palette.withMoved(1, 1, 1), palette);
    assert.ok(palette.equals(ColorPalette.from([kA, kB, kC])));
    assert.ok(!palette.equals(ColorPalette.from([kA, kB])));
  });
});

function gray(
  value: number
): RGBA8 {
  return {
    r: value,
    g: value,
    b: value,
    a: 255
  };
}
