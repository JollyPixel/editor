// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BrushInk } from "#src/tools/BrushInk.ts";
import { Brush } from "#src/tools/Brush.ts";

// CONSTANTS
const kHalfRed = { r: 255, g: 0, b: 0, a: 128 };
const kBlue = { r: 0, g: 0, b: 255, a: 255 };
const kClear = { r: 0, g: 0, b: 0, a: 0 };

describe("BrushInk", () => {
  test("blend composites a translucent color over the pixel under it", () => {
    assert.deepEqual(BrushInk.blend.over(kHalfRed, kBlue), { r: 128, g: 0, b: 127, a: 255 });
    assert.deepEqual(BrushInk.blend.over(kHalfRed, kClear), kHalfRed);
    assert.deepEqual(
      BrushInk.blend.over(kHalfRed, { ...kBlue, a: 128 }),
      { r: 170, g: 0, b: 85, a: 192 }
    );
  });

  test("blend writes opaque and fully transparent colors as they are", () => {
    assert.deepEqual(BrushInk.blend.over({ ...kHalfRed, a: 255 }, kBlue), { ...kHalfRed, a: 255 });
    assert.deepEqual(BrushInk.blend.over(kClear, kBlue), kClear);
  });

  test("replace ignores the pixel under it", () => {
    assert.deepEqual(BrushInk.replace.over(kHalfRed, kBlue), kHalfRed);
  });

  test("lock-alpha tints visible pixels and keeps their alpha", () => {
    assert.deepEqual(
      BrushInk.lockAlpha.over({ ...kHalfRed, a: 255 }, { ...kBlue, a: 64 }),
      { r: 255, g: 0, b: 0, a: 64 }
    );
    assert.deepEqual(BrushInk.lockAlpha.over(kHalfRed, kBlue), { r: 128, g: 0, b: 127, a: 255 });
    assert.deepEqual(BrushInk.lockAlpha.over(kHalfRed, kClear), kClear);
  });
});

describe("Brush.painter", () => {
  test("paints with the color and ink set when it was created", () => {
    const brush = new Brush({ color: "#ff0000" });
    brush.primary.opacity = 128 / 255;
    const paint = brush.painter("primary");

    brush.primary.set("#00ff00", 1);
    brush.ink = "replace";

    assert.deepEqual(paint(kBlue), { r: 128, g: 0, b: 127, a: 255 });
  });

  test("always replaces when erasing", () => {
    const brush = new Brush({ ink: "lock-alpha" });

    assert.deepEqual(brush.painter("erase")(kBlue), kClear);
  });

  test("rejects an unknown ink", () => {
    const brush = new Brush();

    assert.throws(() => {
      Reflect.set(brush, "ink", "multiply");
    }, RangeError);
    assert.equal(brush.ink, "blend");
  });
});
