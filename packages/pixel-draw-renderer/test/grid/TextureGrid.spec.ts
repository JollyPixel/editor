// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TextureGrid } from "#src/grid/TextureGrid.ts";

describe("TextureGrid", () => {
  test("nearestLine rounds a texture coordinate to the closest cell line", () => {
    const grid = new TextureGrid({ size: 16 });

    assert.deepEqual(
      [7, 8, 23, 25, -7, -9].map((value) => grid.nearestLine(value)),
      [0, 16, 16, 32, 0, -16]
    );
    assert.ok(Object.is(grid.nearestLine(-3), 0));
  });

  test("keeps the cell size a positive integer", () => {
    const grid = new TextureGrid({ size: 7.6 });
    assert.equal(grid.size, 8);

    grid.size = 0;
    assert.equal(grid.size, 1);

    grid.size = Number.NaN;
    assert.equal(grid.size, 1);
  });

  test("emits changed only when a setting actually changes", () => {
    const grid = new TextureGrid();
    let changes = 0;
    grid.on("changed", () => {
      changes++;
    });

    grid.size = 16;
    grid.visible = false;
    grid.snap = false;
    grid.color = "rgba(0, 0, 0, 0.45)";
    assert.equal(changes, 0);

    grid.size = 32;
    grid.visible = true;
    grid.snap = true;
    grid.color = "#ff0000";
    assert.equal(changes, 4);
  });
});
