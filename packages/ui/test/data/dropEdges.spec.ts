// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveEdgeDropRows,
  resolveEdgeDropTarget,
  TreeSnapshot
} from "../../src/data/tree/model.ts";
import type { TreeNode } from "../../src/data/tree/contract.ts";
import {
  FOLDER_TREE,
  TREE
} from "../fixtures/tree.ts";

describe("Data.resolveEdgeDropRows", () => {
  test("picks the first and last rows when nothing is moved", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, [], snapshot),
      { firstRow: rows[0], lastRow: rows[rows.length - 1] }
    );
  });

  test("skips a moved row that is last in the tree", () => {
    const snapshot = new TreeSnapshot(TREE, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["b"], snapshot),
      { firstRow: rows[0], lastRow: rows[0] }
    );
  });

  test("skips a moved row that is first in the tree", () => {
    const snapshot = new TreeSnapshot(TREE, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["a"], snapshot),
      { firstRow: rows[1], lastRow: rows[1] }
    );
  });

  test("has no anchor rows left when every row is moved", () => {
    const snapshot = new TreeSnapshot(TREE, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["a", "b"], snapshot),
      { firstRow: undefined, lastRow: undefined }
    );
  });

  test("skips a moved branch's own children, not just the branch itself", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["r2"], snapshot),
      { firstRow: rows[0], lastRow: rows[0] }
    );
  });

  test("keeps the edges when only middle rows move", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["a1", "a2"], snapshot),
      { firstRow: rows[0], lastRow: rows[rows.length - 1] }
    );
  });

  test("ignores moved IDs missing from the tree", () => {
    const snapshot = new TreeSnapshot(TREE, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["missing"], snapshot),
      { firstRow: rows[0], lastRow: rows[1] }
    );
  });

  test("matches filtering every row against every moved ID", () => {
    const nodes = deepTree(4, 3);
    const snapshot = new TreeSnapshot(nodes, new Set(allIds(nodes)));
    const rows = snapshot.visibleRows;
    const ids = rows.map((row) => row.node.id);

    for (let start = 0; start < ids.length; start += 7) {
      for (const movedIds of [
        [ids[start]],
        ids.slice(0, start + 1),
        ids.slice(start),
        [ids[0], ids[start], ids[ids.length - 1]]
      ]) {
        const available = rows.filter(
          (row) => !movedIds.some((id) => snapshot.isSelfOrDescendant(id, row.node.id))
        );

        assert.deepEqual(
          resolveEdgeDropRows(rows, movedIds, snapshot),
          { firstRow: available[0], lastRow: available[available.length - 1] }
        );
      }
    }
  });
});

function deepTree(
  breadth: number,
  depth: number,
  prefix = "n"
): TreeNode[] {
  return Array.from({ length: breadth }, (_, index) => {
    const id = `${prefix}${index}`;

    return depth === 0 ?
      { id, label: id } :
      { id, label: id, children: deepTree(breadth, depth - 1, `${id}.`) };
  });
}

function allIds(
  nodes: readonly TreeNode[]
): string[] {
  return nodes.flatMap((node) => [node.id, ...allIds(node.children ?? [])]);
}

describe("Data.resolveEdgeDropTarget", () => {
  test("anchors at the true last row for an unrelated moved node", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: FOLDER_TREE, movedIds: ["r1"], rows, where: "below" }, snapshot),
      { targetId: "r2", anchorId: "c2", where: "below" }
    );
  });

  test("anchors at the true first row for an unrelated moved node", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: FOLDER_TREE, movedIds: ["c1"], rows, where: "above" }, snapshot),
      { targetId: "r1", anchorId: "r1", where: "above" }
    );
  });

  test("keeps the drop line at a dragged last row's own position, not the row before it", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: FOLDER_TREE, movedIds: ["c2"], rows, where: "below" }, snapshot),
      { targetId: "r2", anchorId: "c2", where: "below" }
    );
  });

  test("falls back to a non-moved row when the edge row cannot climb anywhere new", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: FOLDER_TREE, movedIds: ["r2"], rows, where: "below" }, snapshot),
      { targetId: "r1", anchorId: "r1", where: "below" }
    );
  });

  test("keeps the fallback anchored to a dragged root row itself, not the row before it", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: FOLDER_TREE, movedIds: ["r2"], rows, where: "below" }, snapshot),
      { targetId: "r1", anchorId: "r2", where: "below" }
    );
  });

  test("returns null when there are no rows to anchor to", () => {
    const snapshot = new TreeSnapshot([], new Set());

    assert.equal(
      resolveEdgeDropTarget({ nodes: [], movedIds: [], rows: [], where: "below" }, snapshot),
      null
    );
  });
});
