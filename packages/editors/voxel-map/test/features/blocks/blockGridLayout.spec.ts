// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  blockCellRect,
  computeBlockGridLayout,
  revealCellScrollTop
} from "../../../src/features/blocks/blockGridLayout.ts";

describe("computeBlockGridLayout", () => {
  it("fits as many 64px cells as the width allows", () => {
    assert.deepEqual(computeBlockGridLayout(256), { cols: 4, cellSize: 64 });
  });

  it("spreads the leftover width across the cells", () => {
    assert.deepEqual(computeBlockGridLayout(300), { cols: 4, cellSize: 75 });
  });

  it("returns whole pixel cell sizes", () => {
    const { cols, cellSize } = computeBlockGridLayout(301);

    assert.equal(cols, 4);
    assert.equal(cellSize, 75);
    assert.equal(Number.isInteger(cellSize), true);
  });

  it("never overflows the available width", () => {
    for (let width = 1; width <= 1000; width++) {
      const { cols, cellSize } = computeBlockGridLayout(width);

      assert.ok(cols * cellSize <= Math.max(1, width), `overflow at ${width}`);
    }
  });

  it("falls back to a single cell below one column", () => {
    assert.deepEqual(computeBlockGridLayout(40), { cols: 1, cellSize: 40 });
    assert.deepEqual(computeBlockGridLayout(0), { cols: 1, cellSize: 1 });
    assert.deepEqual(computeBlockGridLayout(-10), { cols: 1, cellSize: 1 });
  });

  it("clamps a non finite width to a single cell", () => {
    assert.deepEqual(computeBlockGridLayout(Number.NaN), {
      cols: 1,
      cellSize: 1
    });
  });
});

describe("blockCellRect", () => {
  const layout = { cols: 4, cellSize: 64 };

  it("places the first cell at the grid origin", () => {
    assert.deepEqual(blockCellRect(0, layout), { x: 0, y: 0, size: 64 });
  });

  it("walks a row before wrapping", () => {
    assert.deepEqual(blockCellRect(3, layout), { x: 192, y: 0, size: 64 });
    assert.deepEqual(blockCellRect(4, layout), { x: 0, y: 64, size: 64 });
  });

  it("stacks rows downward", () => {
    assert.deepEqual(blockCellRect(9, layout), { x: 64, y: 128, size: 64 });
  });

  it("follows a single column layout", () => {
    assert.deepEqual(
      blockCellRect(2, { cols: 1, cellSize: 40 }),
      { x: 0, y: 80, size: 40 }
    );
  });

  it("shrinks the rect on every side of the inset", () => {
    assert.deepEqual(
      blockCellRect(1, layout, 3),
      { x: 67, y: 3, size: 58 }
    );
  });

  it("never inverts a rect smaller than the inset", () => {
    const rect = blockCellRect(0, { cols: 2, cellSize: 4 }, 10);

    assert.equal(rect.size, 1);
    assert.equal(rect.x, 1.5);
  });
});

describe("revealCellScrollTop", () => {
  const rect = { x: 0, y: 128, size: 64 };

  it("keeps a visible cell where it is", () => {
    assert.equal(
      revealCellScrollTop(rect, { scrollTop: 100, height: 200 }),
      null
    );
  });

  it("aligns a cell scrolled past the top", () => {
    assert.equal(
      revealCellScrollTop(rect, { scrollTop: 160, height: 200 }),
      128
    );
  });

  it("aligns a cell below the fold on its bottom edge", () => {
    assert.equal(
      revealCellScrollTop(rect, { scrollTop: 0, height: 100 }),
      92
    );
  });

  it("does nothing without a measured window", () => {
    assert.equal(
      revealCellScrollTop(rect, { scrollTop: 0, height: 0 }),
      null
    );
  });
});
