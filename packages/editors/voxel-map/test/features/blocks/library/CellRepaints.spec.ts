// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CellRepaints,
  type CellPaint,
  type RepaintedCell
} from "../../../../src/features/blocks/library/CellRepaints.ts";

function cell(
  id: number,
  mesh = `mesh-${id}`
): RepaintedCell<string> {
  return {
    block: { id },
    mesh
  };
}

function due(
  repaints: CellRepaints<string>,
  cells: RepaintedCell<string>[],
  spinning: number[] = [],
  range = { first: 0, last: cells.length - 1 }
): CellPaint[] {
  return [...repaints.due(cells, range, (id) => spinning.includes(id))];
}

describe("CellRepaints", () => {
  it("paints each visible cell once, then nothing until it changes", () => {
    const repaints = new CellRepaints<string>();
    const cells = [cell(1), cell(2)];

    assert.deepEqual(due(repaints, cells), [
      { index: 0, mode: "still" },
      { index: 1, mode: "still" }
    ]);
    assert.deepEqual(due(repaints, cells), []);
    assert.deepEqual(due(repaints, [cell(1), cell(2, "rebuilt")]), [
      { index: 1, mode: "still" }
    ]);
  });

  it("spins a cell every frame and stills it once it stops", () => {
    const repaints = new CellRepaints<string>();
    const cells = [cell(1), cell(2)];
    due(repaints, cells);

    assert.deepEqual(due(repaints, cells, [2]), [{ index: 1, mode: "spinning" }]);
    assert.deepEqual(due(repaints, cells, [2]), [{ index: 1, mode: "spinning" }]);
    assert.deepEqual(due(repaints, cells), [{ index: 1, mode: "still" }]);
  });

  it("leaves cells outside the range for when they scroll in", () => {
    const repaints = new CellRepaints<string>();
    const cells = [cell(1), cell(2), cell(3)];

    assert.deepEqual(due(repaints, cells, [], { first: 0, last: 0 }), [
      { index: 0, mode: "still" }
    ]);
    assert.deepEqual(due(repaints, cells, [], { first: 1, last: 5 }), [
      { index: 1, mode: "still" },
      { index: 2, mode: "still" }
    ]);
  });

  it("erases painted cells past the end of a shorter list", () => {
    const repaints = new CellRepaints<string>();
    due(repaints, [cell(1), cell(2), cell(3)]);

    assert.deepEqual(due(repaints, [cell(1)]), [
      { index: 1, mode: "erase" },
      { index: 2, mode: "erase" }
    ]);
    assert.deepEqual(due(repaints, [cell(1)]), []);
  });

  it("repaints everything after an invalidation", () => {
    const repaints = new CellRepaints<string>();
    const cells = [cell(1), cell(2)];
    due(repaints, cells);

    repaints.invalidate();

    assert.equal(due(repaints, cells).length, 2);
  });
});
