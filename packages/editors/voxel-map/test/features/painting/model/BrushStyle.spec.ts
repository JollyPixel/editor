// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  DEFAULT_BRUSH_STYLE,
  brushStyleFrom,
  readBrushStyle
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

describe("readBrushStyle", () => {
  test("defaults on anything that is not an object", () => {
    assert.strictEqual(readBrushStyle(null), DEFAULT_BRUSH_STYLE);
    assert.strictEqual(readBrushStyle("dashed"), DEFAULT_BRUSH_STYLE);
  });

  test("keeps the members it can trust", () => {
    const style = readBrushStyle({
      opacity: 0.8,
      edgeWidth: "wide",
      edgeStyle: "dashed"
    });

    assert.strictEqual(style.opacity, 0.8);
    assert.strictEqual(style.edgeWidth, DEFAULT_BRUSH_STYLE.edgeWidth);
    assert.strictEqual(style.edgeStyle, "dashed");
  });
});
