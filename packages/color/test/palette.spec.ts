// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ColorSequence } from "../src/palette/ColorSequence.ts";
import { hashKey } from "../src/palette/hashKey.ts";
import { parseColor } from "../src/parse/index.ts";
import { ColorSpace } from "../src/convert/index.ts";

// CONSTANTS
const kKeys = ["", "a", "peer-42", "a-much-longer-client-id"];

describe("ColorSequence.from", () => {
  test("cycles through its colors by index, in both directions", () => {
    const sequence = ColorSequence.from(["#a", "#b"]);

    assert.deepEqual(
      [0, 1, 2, -1].map((index) => sequence.at(index)),
      ["#a", "#b", "#a", "#b"]
    );
  });

  test("picks a stable color from its list for each key", () => {
    const colors = ["#a", "#b", "#c"];
    const sequence = ColorSequence.from(colors);

    for (const key of kKeys) {
      assert.ok(colors.includes(sequence.pick(key)), key);
      assert.equal(sequence.pick(key), sequence.pick(key), key);
    }
  });

  test("copies the caller's array so later edits do not leak in", () => {
    const colors = ["#a", "#b"];
    const sequence = ColorSequence.from(colors);

    colors[0] = "#c";

    assert.equal(sequence.at(0), "#a");
  });

  test("rejects an empty list", () => {
    assert.throws(() => ColorSequence.from([]), RangeError);
  });

  test("the default sequence spreads keys over several colors", () => {
    const picked = new Set(
      Array.from({ length: 50 }, (_, index) => ColorSequence.default.pick(`peer-${index}`))
    );

    assert.ok(picked.size > 1);
  });
});

describe("ColorSequence.goldenAngle", () => {
  test("defaults to 72% saturation and 70% lightness", () => {
    const sequence = ColorSequence.goldenAngle();

    assert.equal(sequence.at(0), "#ea7b7b");
    assert.equal(sequence.at(1), "#7bea9c");
  });

  test("keeps adjacent indexes far apart in hue", () => {
    const sequence = ColorSequence.goldenAngle();
    const distance = Math.abs(readHue(sequence.at(0)) - readHue(sequence.at(1)));

    assert.ok(Math.min(distance, 360 - distance) > 90);
  });

  test("honours saturation and lightness overrides", () => {
    assert.equal(
      ColorSequence.goldenAngle({ saturation: 0, lightness: 0.5 }).at(0),
      "#808080"
    );
  });
});

describe("hashKey", () => {
  test("is non-negative", () => {
    for (const key of ["", "z", "\u{1F600}", "peer-999999"]) {
      assert.ok(hashKey(key) >= 0, key);
    }
  });
});

function readHue(
  hex: string
): number {
  const color = parseColor(hex);
  if (color === null) {
    assert.fail(`${hex} did not parse`);
  }

  return ColorSpace.hsl.fromRgb(color).h;
}
