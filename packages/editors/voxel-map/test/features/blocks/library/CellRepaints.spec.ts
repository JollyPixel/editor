// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CellRepaints,
  type CellLook,
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
  looks: Record<number, CellLook> = {},
  range = { first: 0, last: cells.length - 1 }
): CellPaint[] {
  return [...repaints.due(cells, range, (id) => looks[id] ?? "still")];
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

    const spinning = { 2: "spinning" } as const;
    assert.deepEqual(due(repaints, cells, spinning), [{ index: 1, mode: "spinning" }]);
    assert.deepEqual(due(repaints, cells, spinning), [{ index: 1, mode: "spinning" }]);
    assert.deepEqual(due(repaints, cells), [{ index: 1, mode: "still" }]);
  });

  it("erases a hidden cell once and repaints it when shown again", () => {
    const repaints = new CellRepaints<string>();
    const cells = [cell(1), cell(2)];
    due(repaints, cells);

    const hidden = { 2: "hidden" } as const;
    assert.deepEqual(due(repaints, cells, hidden), [{ index: 1, mode: "erase" }]);
    assert.deepEqual(due(repaints, cells, hidden), []);
    assert.deepEqual(due(repaints, [cell(2), cell(1)], hidden), [
      { index: 0, mode: "erase" },
      { index: 1, mode: "still" }
    ]);
    assert.deepEqual(due(repaints, [cell(2), cell(1)]), [
      { index: 0, mode: "still" }
    ]);
  });

  it("leaves cells outside the range for when they scroll in", () => {
    const repaints = new CellRepaints<string>();
    const cells = [cell(1), cell(2), cell(3)];

    assert.deepEqual(due(repaints, cells, {}, { first: 0, last: 0 }), [
      { index: 0, mode: "still" }
    ]);
    assert.deepEqual(due(repaints, cells, {}, { first: 1, last: 5 }), [
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
