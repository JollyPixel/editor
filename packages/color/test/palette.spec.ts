// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ColorPalette } from "../src/palette/ColorPalette.ts";
import {
  colorFromKey,
  defaultPaletteColors,
  goldenAngleColor,
  hashKey
} from "../src/palette/deterministic.ts";
import { parseColor } from "../src/parse/index.ts";
import { rgbToHsl } from "../src/convert/index.ts";

describe("ColorPalette", () => {
  test("cycles through its colors in order", () => {
    const palette = new ColorPalette({ colors: ["#a", "#b"] });

    assert.equal(palette.next(), "#a");
    assert.equal(palette.next(), "#b");
    assert.equal(palette.next(), "#a");
  });

  test("reset restarts the cycle", () => {
    const palette = new ColorPalette({ colors: ["#a", "#b"] });

    palette.next();
    palette.reset();

    assert.equal(palette.next(), "#a");
  });

  test("forKey is stable for the same key", () => {
    const palette = new ColorPalette();

    assert.equal(palette.forKey("peer-1"), palette.forKey("peer-1"));
    assert.notEqual(palette.forKey("peer-1"), palette.next());
  });

  test("defaults to the built-in palette and cannot be tampered with", () => {
    const palette = new ColorPalette();

    assert.deepEqual(palette.colors, defaultPaletteColors());
    assert.throws(
      () => (palette.colors as string[]).push("#000"),
      TypeError
    );
    assert.equal(palette.colors.length, defaultPaletteColors().length);
  });

  test("copies the caller's array so later edits do not leak in", () => {
    const colors = ["#a", "#b"];
    const palette = new ColorPalette({ colors });

    colors.push("#c");

    assert.deepEqual(palette.colors, ["#a", "#b"]);
  });
});

describe("colorFromKey", () => {
  test("is deterministic and stays inside the palette", () => {
    const colors = defaultPaletteColors();

    for (const key of ["", "a", "peer-42", "a-much-longer-client-id"]) {
      const color = colorFromKey(key);

      assert.equal(color, colorFromKey(key), key);
      assert.ok(colors.includes(color), key);
    }
  });

  test("honours a supplied palette", () => {
    assert.equal(colorFromKey("peer-1", ["#only"]), "#only");
  });

  test("hashKey is non-negative", () => {
    for (const key of ["", "z", "\u{1F600}", "peer-999999"]) {
      assert.ok(hashKey(key) >= 0, key);
    }
  });
});

describe("goldenAngleColor", () => {
  test("returns a parseable hex color", () => {
    assert.match(goldenAngleColor(0), /^#[0-9a-f]{6}$/);
  });

  test("keeps adjacent indexes far apart in hue", () => {
    const first = hueOf(goldenAngleColor(0));
    const second = hueOf(goldenAngleColor(1));
    const distance = Math.abs(first - second);

    assert.ok(Math.min(distance, 360 - distance) > 90);
  });

  test("is stable and repeats only after a full rotation", () => {
    assert.equal(goldenAngleColor(3), goldenAngleColor(3));
    assert.notEqual(goldenAngleColor(3), goldenAngleColor(4));
  });

  test("honours saturation and lightness overrides", () => {
    assert.equal(
      goldenAngleColor(0, { saturation: 0, lightness: 0.5 }),
      "#808080"
    );
  });
});

function hueOf(
  hex: string
): number {
  const color = parseColor(hex);
  if (color === null) {
    assert.fail(`${hex} did not parse`);
  }

  return rgbToHsl(color).h;
}
