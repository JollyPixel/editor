// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sortColors } from "../src/palette/sortColors.ts";
import { formatHex } from "../src/format.ts";
import { parseColor } from "../src/parse/parseColor.ts";
import type { RGBA } from "../src/types.ts";

describe("sortColors", () => {
  test("sorts by hue with grays first, darkest gray leading", () => {
    const sorted = sortColors(
      colors("#0000ff", "#ffffff", "#ff0000", "#000000", "#00ff00"),
      "hue"
    );

    assert.deepEqual(hexes(sorted), [
      "#000000",
      "#ffffff",
      "#ff0000",
      "#00ff00",
      "#0000ff"
    ]);
  });

  test("sorts by lightness and by chroma", () => {
    const input = colors("#ffffff", "#ff0000", "#000000");

    assert.deepEqual(hexes(sortColors(input, "lightness")), [
      "#000000",
      "#ff0000",
      "#ffffff"
    ]);
    assert.deepEqual(hexes(sortColors(colors("#ff0000", "#808080", "#ff8080"), "chroma")), [
      "#808080",
      "#ff8080",
      "#ff0000"
    ]);
  });

  test("keeps the order of ties and leaves the input untouched", () => {
    const input = colors("#ff000080", "#00ff00", "#0000ff80");
    const sorted = sortColors(input, "alpha");

    assert.deepEqual(hexes(sorted), ["#ff0000", "#0000ff", "#00ff00"]);
    assert.deepEqual(hexes(input), ["#ff0000", "#00ff00", "#0000ff"]);
  });
});

function colors(
  ...values: string[]
): RGBA[] {
  return values.map((value) => {
    const color = parseColor(value);
    assert.ok(color);

    return color;
  });
}

function hexes(
  values: readonly RGBA[]
): string[] {
  return values.map((value) => formatHex(value));
}
