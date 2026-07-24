// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ColorPalette } from "#src/utils/ColorPalette.ts";

describe("ColorPalette — next", () => {
  test("cycles through the built-in palette in order", () => {
    const palette = new ColorPalette();

    const first = palette.next();
    const second = palette.next();

    assert.notStrictEqual(first, second);
  });

  test("wraps back to the first color once the palette is exhausted", () => {
    const palette = new ColorPalette({ colors: ["#111111", "#222222"] });

    assert.strictEqual(palette.next(), "#111111");
    assert.strictEqual(palette.next(), "#222222");
    assert.strictEqual(palette.next(), "#111111");
  });
});

describe("ColorPalette — reset", () => {
  test("restarts next() from the beginning of the palette", () => {
    const palette = new ColorPalette({ colors: ["#111111", "#222222"] });

    palette.next();
    palette.reset();

    assert.strictEqual(palette.next(), "#111111");
  });
});

describe("ColorPalette — forKey", () => {
  test("returns the same color for the same key", () => {
    const palette = new ColorPalette();

    assert.strictEqual(
      palette.forKey("client-A"),
      palette.forKey("client-A")
    );
  });

  test("returns different colors for different keys", () => {
    const palette = new ColorPalette();

    assert.notStrictEqual(
      palette.forKey("client-A"),
      palette.forKey("client-B")
    );
  });

  test("only ever returns a color from the configured palette", () => {
    const colors = ["#111111", "#222222", "#333333"];
    const palette = new ColorPalette({ colors });

    assert.ok(colors.includes(palette.forKey("client-A")));
  });

  test("does not consume next()'s cascading index", () => {
    const palette = new ColorPalette({ colors: ["#111111", "#222222"] });

    palette.forKey("client-A");
    assert.strictEqual(palette.next(), "#111111");
  });
});

describe("ColorPalette — custom colors", () => {
  test("uses the provided palette instead of the built-in default", () => {
    const palette = new ColorPalette({ colors: ["#abcdef"] });

    assert.strictEqual(palette.next(), "#abcdef");
    assert.strictEqual(palette.forKey("anything"), "#abcdef");
  });
});
