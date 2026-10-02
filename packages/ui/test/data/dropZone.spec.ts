// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveDropDepth,
  resolveDropIndicatorRow,
  resolveEdgeDropRows,
  resolveEdgeDropTarget,
  resolveRowDropStyle,
  resolveRowDropZone,
  TreeSnapshot
} from "../../src/data/tree/model.ts";
import type { TreeNode } from "../../src/data/tree/contract.ts";
import {
  FOLDER_TREE,
  TREE
} from "../fixtures/tree.ts";

describe("Data.resolveRowDropZone", () => {
  test("accepts a row rectangle and client position", () => {
    assert.equal(
      resolveRowDropZone({ top: 100, height: 40 }, 105),
      "above"
    );
    assert.equal(
      resolveRowDropZone({ top: 100, height: 40 }, 120),
      "inside"
    );
    assert.equal(
      resolveRowDropZone({ top: 100, height: 40 }, 135),
      "below"
    );
  });

  test("the top quarter is above", () => {
    assert.equal(resolveRowDropZone(0, 20), "above");
    assert.equal(resolveRowDropZone(4, 20), "above");
  });

  test("the bottom quarter is below", () => {
    assert.equal(resolveRowDropZone(16, 20), "below");
    assert.equal(resolveRowDropZone(19, 20), "below");
  });

  test("the middle half is inside, regardless of whether the row has children today", () => {
    assert.equal(resolveRowDropZone(5, 20), "inside");
    assert.equal(resolveRowDropZone(10, 20), "inside");
    assert.equal(resolveRowDropZone(15, 20), "inside");
  });

  test("scales the quarters with row height", () => {
    assert.equal(resolveRowDropZone(9, 40), "above");
    assert.equal(resolveRowDropZone(11, 40), "inside");
    assert.equal(resolveRowDropZone(31, 40), "below");
  });
});

describe("Data.resolveDropDepth", () => {
  test("picks the root band at the container's left edge", () => {
    assert.equal(resolveDropDepth(0, 0, 16, 3), 0);
  });

  test("steps one band deeper per indent unit", () => {
    assert.equal(resolveDropDepth(16, 0, 16, 3), 1);
    assert.equal(resolveDropDepth(32, 0, 16, 3), 2);
  });

  test("clamps to the root band left of the container", () => {
    assert.equal(resolveDropDepth(-40, 0, 16, 3), 0);
  });

  test("clamps to the deepest band past the chain's own depth", () => {
    assert.equal(resolveDropDepth(1000, 0, 16, 3), 2);
  });

  test("reads position relative to the container's left edge", () => {
    assert.equal(resolveDropDepth(116, 100, 16, 3), 1);
  });
});

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

describe("Data.resolveDropIndicatorRow", () => {
  test("renders at the hovered row itself on a direct hover, even over a branch", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a", where: "below" }),
      { rowId: "a", where: "below", depth: 0 }
    );
  });

  test("renders at the hovered row itself for 'above' and 'inside' too", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a2", anchorId: "a2", where: "above" }),
      { rowId: "a2", where: "above", depth: 1 }
    );
    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a", where: "inside" }),
      { rowId: "a", where: "inside", depth: 0 }
    );
  });

  test("renders at the promoted boundary row, using the promoted target's depth", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a2a", where: "below" }),
      { rowId: "a2a", where: "below", depth: 0 }
    );
  });

  test("returns null when the target id is unknown", () => {
    const snapshot = new TreeSnapshot(TREE, new Set());

    assert.equal(
      resolveDropIndicatorRow(snapshot, { targetId: "missing", anchorId: "missing", where: "below" }),
      null
    );
  });

  test("stays on the parent's own row when hovering it directly, not its last child", () => {
    const snapshot = new TreeSnapshot(FOLDER_TREE, new Set(["r2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "r2", anchorId: "r2", where: "below" }),
      { rowId: "r2", where: "below", depth: 0 }
    );
  });
});

describe("Data.resolveRowDropStyle", () => {
  test("carries no drop line for a row the indicator does not anchor to", () => {
    assert.deepEqual(
      resolveRowDropStyle("a1", "calc(1 * 16px)", {
        rowId: "a2a",
        where: "below",
        depth: 0
      }),
      { drop: null, dropIndent: "calc(1 * 16px)" }
    );
  });

  test("carries no drop line when nothing is being dropped", () => {
    assert.deepEqual(
      resolveRowDropStyle("a1", "calc(1 * 16px)", null),
      { drop: null, dropIndent: "calc(1 * 16px)" }
    );
  });

  test("uses the indicator's target depth for the anchor row's drop line", () => {
    assert.deepEqual(
      resolveRowDropStyle("a2a", "calc(2 * 16px)", {
        rowId: "a2a",
        where: "below",
        depth: 0
      }),
      { drop: "below", dropIndent: "calc(0 * var(--jolly-tree-indent, 16px))" }
    );
  });
});
