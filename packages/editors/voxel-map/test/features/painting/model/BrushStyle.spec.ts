// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleFrom
} from "../../../../src/features/painting/model/BrushStyle.ts";

describe("brushStyleFrom", () => {
  test("keeps the base where the patch says nothing", () => {
    assert.deepStrictEqual(
      brushStyleFrom({ opacity: 0.5 }),
      {
        ...DEFAULT_BRUSH_STYLE,
        opacity: 0.5
      }
    );
  });

  test("clamps a member instead of dropping the style", () => {
    const style = brushStyleFrom({
      opacity: -2,
      edgeWidth: 40
    });

    assert.strictEqual(style.opacity, 0);
    assert.strictEqual(style.edgeWidth, 8);
  });

  test("falls back on an unknown edge style", () => {
    const style = brushStyleFrom({
      edgeStyle: "dotted" as "solid"
    });

    assert.strictEqual(style.edgeStyle, DEFAULT_BRUSH_STYLE.edgeStyle);
  });

  test("returns the base untouched for an empty patch", () => {
    const base = brushStyleFrom({ opacity: 0.4 });

    assert.strictEqual(brushStyleFrom(null, base), base);
  });
});
