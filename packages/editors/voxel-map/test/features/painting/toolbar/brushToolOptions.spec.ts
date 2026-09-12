// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  BRUSH_AXIS_OPTIONS,
  BRUSH_DISABLED_LABEL,
  BRUSH_MODE_OPTIONS,
  BRUSH_PATTERN_OPTIONS,
  choiceOf,
  toolLabel
} from "../../../../src/features/painting/toolbar/brushToolOptions.ts";

describe("brushToolOptions.choiceOf", () => {
  test("shows the current value and offers the others", () => {
    const { active, alternatives } = choiceOf(BRUSH_AXIS_OPTIONS, "yz");

    assert.equal(active.icon, "axis-yz");
    assert.deepEqual(
      alternatives.map((option) => option.value),
      ["xz", "xy", "xyz"]
    );
  });

  test("a two-value tool offers the single alternative", () => {
    assert.deepEqual(
      choiceOf(BRUSH_MODE_OPTIONS, "build").alternatives.map(
        (option) => option.value
      ),
      ["replace"]
    );
    assert.deepEqual(
      choiceOf(BRUSH_PATTERN_OPTIONS, "circle").alternatives.map(
        (option) => option.value
      ),
      ["square"]
    );
  });

  test("every option has a distinct icon", () => {
    const icons = [
      ...BRUSH_MODE_OPTIONS,
      ...BRUSH_AXIS_OPTIONS,
      ...BRUSH_PATTERN_OPTIONS
    ].map((option) => option.icon);

    assert.equal(new Set(icons).size, icons.length);
  });
});

describe("brushToolOptions.toolLabel", () => {
  test("appends the shortcut", () => {
    assert.equal(toolLabel("Replace", "R", false), "Replace (R)");
  });

  test("explains why a disabled tool cannot be used", () => {
    assert.equal(toolLabel("Replace", "R", true), BRUSH_DISABLED_LABEL);
  });
});
