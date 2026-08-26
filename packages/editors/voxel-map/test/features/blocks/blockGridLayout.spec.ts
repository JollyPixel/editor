// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { computeBlockGridLayout } from "../../../src/features/blocks/blockGridLayout.ts";

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
