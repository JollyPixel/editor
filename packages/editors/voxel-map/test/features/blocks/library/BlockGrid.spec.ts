// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  BlockCell,
  BlockGrid
} from "../../../../src/features/blocks/library/BlockGrid.ts";

function readLayout(
  grid: BlockGrid
) {
  return {
    cols: grid.cols,
    cellSize: grid.cellSize
  };
}

function readRect(
  cell: BlockCell
) {
  return {
    x: cell.x,
    y: cell.y,
    size: cell.size
  };
}

describe("BlockGrid.fit", () => {
  it("fits as many 64px cells as the width allows", () => {
    assert.deepEqual(readLayout(BlockGrid.fit(256)), { cols: 4, cellSize: 64 });
  });

  it("spreads the leftover width across the cells", () => {
    assert.deepEqual(readLayout(BlockGrid.fit(300)), { cols: 4, cellSize: 75 });
  });

  it("returns whole pixel cell sizes", () => {
    const { cols, cellSize } = BlockGrid.fit(301);

    assert.equal(cols, 4);
    assert.equal(cellSize, 75);
    assert.equal(Number.isInteger(cellSize), true);
  });

  it("never overflows the available width", () => {
    for (let width = 1; width <= 1000; width++) {
      const { cols, cellSize } = BlockGrid.fit(width);

      assert.ok(cols * cellSize <= Math.max(1, width), `overflow at ${width}`);
    }
  });

  it("falls back to a single cell below one column", () => {
    assert.deepEqual(readLayout(BlockGrid.fit(40)), { cols: 1, cellSize: 40 });
    assert.deepEqual(readLayout(BlockGrid.fit(0)), { cols: 1, cellSize: 1 });
    assert.deepEqual(readLayout(BlockGrid.fit(-10)), { cols: 1, cellSize: 1 });
  });

  it("clamps a non finite width to a single cell", () => {
    assert.deepEqual(readLayout(BlockGrid.fit(Number.NaN)), {
      cols: 1,
      cellSize: 1
    });
  });

  it("compares by columns and cell size", () => {
    assert.equal(BlockGrid.fit(256).equals(new BlockGrid(4, 64)), true);
    assert.equal(BlockGrid.fit(256).equals(new BlockGrid(4, 65)), false);
  });
});

describe("BlockGrid.cellAt", () => {
  const grid = new BlockGrid(4, 64);

  it("places the first cell at the grid origin", () => {
    assert.deepEqual(readRect(grid.cellAt(0)), { x: 0, y: 0, size: 64 });
  });

  it("walks a row before wrapping", () => {
    assert.deepEqual(readRect(grid.cellAt(3)), { x: 192, y: 0, size: 64 });
    assert.deepEqual(readRect(grid.cellAt(4)), { x: 0, y: 64, size: 64 });
  });

  it("stacks rows downward", () => {
    assert.deepEqual(readRect(grid.cellAt(9)), { x: 64, y: 128, size: 64 });
  });

  it("follows a single column layout", () => {
    assert.deepEqual(
      readRect(new BlockGrid(1, 40).cellAt(2)),
      { x: 0, y: 80, size: 40 }
    );
  });

  it("shrinks the rect on every side of the inset", () => {
    assert.deepEqual(readRect(grid.cellAt(1, 3)), { x: 67, y: 3, size: 58 });
  });

  it("never inverts a rect smaller than the inset", () => {
    const cell = new BlockGrid(2, 4).cellAt(0, 10);

    assert.equal(cell.size, 1);
    assert.equal(cell.x, 1.5);
  });
});

describe("BlockGrid.indexAt", () => {
  const grid = new BlockGrid(4, 50);

  it("finds the cell under a point", () => {
    assert.equal(grid.indexAt(60, 10), 1);
    assert.equal(grid.indexAt(10, 60), 4);
  });

  it("finds nothing left of, above or right of the columns", () => {
    assert.equal(grid.indexAt(-1, 10), null);
    assert.equal(grid.indexAt(10, -1), null);
    assert.equal(grid.indexAt(200, 10), null);
  });
});

describe("BlockCell", () => {
  it("positions and sizes an overlay", () => {
    assert.equal(
      new BlockCell(67, 3, 58).style,
      "left:67px;top:3px;width:58px;height:58px"
    );
  });

  describe("scrollTopToReveal", () => {
    const cell = new BlockCell(0, 128, 64);

    it("keeps a visible cell where it is", () => {
      assert.equal(cell.scrollTopToReveal({ scrollTop: 100, height: 200 }), null);
    });

    it("aligns a cell scrolled past the top", () => {
      assert.equal(cell.scrollTopToReveal({ scrollTop: 160, height: 200 }), 128);
    });

    it("aligns a cell below the fold on its bottom edge", () => {
      assert.equal(cell.scrollTopToReveal({ scrollTop: 0, height: 100 }), 92);
    });

    it("does nothing without a measured window", () => {
      assert.equal(cell.scrollTopToReveal({ scrollTop: 0, height: 0 }), null);
    });
  });
});

describe("BlockGrid.landingIndex", () => {
  const grid = new BlockGrid(4, 50);

  it("lands on the cell under the pointer", () => {
    assert.equal(grid.landingIndex(60, 10, 8), 1);
    assert.equal(grid.landingIndex(10, 60, 8), 4);
  });

  it("clamps a pointer beside the columns to the nearest one", () => {
    assert.equal(grid.landingIndex(-20, 60, 8), 4);
    assert.equal(grid.landingIndex(500, 10, 8), 3);
  });

  it("clamps a pointer above the grid to the first row", () => {
    assert.equal(grid.landingIndex(60, -30, 8), 1);
  });

  it("lands a pointer past the last block on the last block", () => {
    assert.equal(grid.landingIndex(10, 900, 6), 5);
    assert.equal(grid.landingIndex(120, 60, 6), 5);
  });

  it("returns 0 for an empty grid", () => {
    assert.equal(grid.landingIndex(120, 80, 0), 0);
  });
});

describe("BlockGrid.rows", () => {
  it("reserves a row for the add cell of an empty library", () => {
    assert.equal(new BlockGrid(4, 1).rows(0), 1);
  });

  it("keeps the add cell on a partially filled last row", () => {
    assert.equal(new BlockGrid(4, 1).rows(3), 1);
    assert.equal(new BlockGrid(4, 1).rows(6), 2);
  });

  it("opens a new row when the last row is full", () => {
    assert.equal(new BlockGrid(4, 1).rows(4), 2);
    assert.equal(new BlockGrid(4, 1).rows(8), 3);
  });

  it("treats a non-positive column count as one column", () => {
    assert.equal(new BlockGrid(0, 1).rows(2), 3);
  });
});
