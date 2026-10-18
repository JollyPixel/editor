// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { OptionGrid } from "../../src/controls/OptionGrid.ts";
import { OptionGroups } from "../../src/controls/OptionGroups.ts";
import type { JollyOption } from "../../src/controls/types.ts";

// CONSTANTS
const kShapes = [
  option("cube", "Block"),
  option("slab", "Block"),
  option("beam", "Block"),
  option("notch", "Block"),
  option("ramp", "Ramp"),
  option("tip", "Ramp", true),
  option("valley", "Ramp")
];

function option(
  value: string,
  group?: string,
  disabled = false
): JollyOption<string> {
  return {
    value,
    label: value,
    group,
    disabled
  };
}

function grid(
  options: JollyOption<string>[],
  columns: number
): OptionGrid<string> {
  return new OptionGrid(new OptionGroups(options), columns);
}

describe("Controls.OptionGrid", () => {
  test("moves down to the same column of the next row, across groups", () => {
    const shapes = grid(kShapes, 3);

    assert.equal(shapes.move(1, "ArrowDown"), 3);
    assert.equal(shapes.move(3, "ArrowDown"), 4);
    assert.equal(shapes.move(4, "ArrowUp"), 3);
    assert.equal(shapes.move(3, "ArrowUp"), 0);
  });

  test("lands on the nearest enabled option of a shorter or partly disabled row", () => {
    const shapes = grid(kShapes, 3);

    assert.equal(shapes.move(2, "ArrowDown"), 3);
    assert.equal(shapes.move(4, "ArrowRight"), 6);
    assert.equal(grid(kShapes, 4).move(1, "ArrowDown"), 4);
  });

  test("lays out a fractional column count as whole columns", () => {
    const shapes = grid(kShapes, 2.5);

    assert.equal(shapes.columns, 2);
    assert.equal(shapes.move(0, "ArrowDown"), 2);
  });

  test("stays put at the first and last rows", () => {
    const shapes = grid(kShapes, 3);

    assert.equal(shapes.move(0, "ArrowUp"), 0);
    assert.equal(shapes.move(6, "ArrowDown"), 6);
  });

  test("jumps to the first and last enabled options", () => {
    const shapes = grid([
      option("off", undefined, true),
      ...kShapes.slice(0, 5),
      option("off", undefined, true)
    ], 3);

    assert.equal(shapes.move(3, "Home"), 1);
    assert.equal(shapes.move(3, "End"), 5);
  });

  test("ignores keys that do not navigate", () => {
    assert.equal(grid(kShapes, 3).move(0, "Enter"), -1);
  });
});
