// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LayerGridLayout } from "../../src/controls/LayerGridLayout.ts";

describe("Controls.LayerGridLayout", () => {
  test("fills blocks of two rows, the last one partial", () => {
    const layout = new LayerGridLayout(12, 3);

    assert.deepEqual(
      [...layout.blocks()],
      [
        [0, 1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10, 11]
      ]
    );
    assert.deepEqual(
      [...new LayerGridLayout(7, 2).blocks()],
      [
        [0, 1, 2, 3],
        [4, 5, 6]
      ]
    );
  });

  test("clamps count to 1..32 and columns to the count", () => {
    assert.equal(new LayerGridLayout(64, 8).count, LayerGridLayout.MaxCount);
    assert.equal(new LayerGridLayout(0, 8).count, 1);
    assert.equal(new LayerGridLayout(4.7, 8).count, 4);
    assert.equal(new LayerGridLayout(4, 8).columns, 4);
    assert.equal(new LayerGridLayout(4, 0).columns, 1);
  });

  test("moves right from a block's last column into the next block's same row", () => {
    const layout = new LayerGridLayout(20, 5);

    assert.equal(layout.moveFrom(4, "right"), 10);
    assert.equal(layout.moveFrom(9, "right"), 15);
    assert.equal(layout.moveFrom(10, "left"), 4);
  });

  test("moves between the two rows of a block", () => {
    const layout = new LayerGridLayout(20, 5);

    assert.equal(layout.moveFrom(2, "down"), 7);
    assert.equal(layout.moveFrom(17, "up"), 12);
  });

  test("stays put at the grid edges", () => {
    const layout = new LayerGridLayout(20, 5);

    assert.equal(layout.moveFrom(0, "left"), 0);
    assert.equal(layout.moveFrom(19, "right"), 19);
    assert.equal(layout.moveFrom(3, "up"), 3);
    assert.equal(layout.moveFrom(18, "down"), 18);
  });

  test("never lands on a cell missing from a partial block", () => {
    const layout = new LayerGridLayout(12, 4);

    assert.equal(layout.moveFrom(9, "down"), 9);
    assert.equal(layout.moveFrom(7, "right"), 7);
    assert.equal(layout.moveFrom(3, "right"), 8);
  });

  test("jumps to the first and last cell", () => {
    const layout = new LayerGridLayout(20, 5);

    assert.equal(layout.moveFrom(12, "first"), 0);
    assert.equal(layout.moveFrom(3, "last"), 19);
  });
});
