// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ancestorChain,
  findNode,
  findParentId,
  flattenVisible,
  hasChildren,
  isExpandable,
  isSelfOrDescendant,
  resolveDropIndicatorRow,
  resolveEdgeDropRows,
  resolveEdgeDropTarget,
  resolveRootDropTarget,
  resolveRowDropStyle,
  TreeSnapshot
} from "../../src/data/tree/model.ts";
import type { TreeNode } from "../../src/data/tree/contract.ts";

// CONSTANTS
const kTree: TreeNode[] = [
  {
    id: "a",
    label: "A",
    children: [
      { id: "a1", label: "A1" },
      {
        id: "a2",
        label: "A2",
        children: [
          { id: "a2a", label: "A2A" }
        ]
      }
    ]
  },
  { id: "b", label: "B" }
];
const kFolderTree: TreeNode[] = [
  { id: "r1", label: "R1" },
  {
    id: "r2",
    label: "R2",
    children: [
      { id: "c1", label: "C1" },
      { id: "c2", label: "C2" }
    ]
  }
];

describe("Data.flattenVisible", () => {
  test("skips a collapsed branch's children", () => {
    const rows = flattenVisible(kTree, new Set());

    assert.deepEqual(
      rows.map((row) => row.node.id),
      ["a", "b"]
    );
  });

  test("includes an expanded branch's children, depth first", () => {
    const rows = flattenVisible(kTree, new Set(["a"]));

    assert.deepEqual(
      rows.map((row) => row.node.id),
      ["a", "a1", "a2", "b"]
    );
  });

  test("nests through several expanded levels", () => {
    const rows = flattenVisible(kTree, new Set(["a", "a2"]));

    assert.deepEqual(
      rows.map((row) => row.node.id),
      ["a", "a1", "a2", "a2a", "b"]
    );
    assert.deepEqual(
      rows.map((row) => row.depth),
      [0, 1, 1, 2, 0]
    );
  });

  test("records each row's parent id", () => {
    const rows = flattenVisible(kTree, new Set(["a", "a2"]));

    assert.deepEqual(
      rows.map((row) => row.parentId),
      [null, "a", "a", "a2", null]
    );
  });
});

describe("Data.findNode", () => {
  test("finds a top-level node", () => {
    assert.equal(findNode(kTree, "b")?.label, "B");
  });

  test("finds a node nested under a collapsed branch", () => {
    assert.equal(findNode(kTree, "a2a")?.label, "A2A");
  });

  test("returns null for an unknown id", () => {
    assert.equal(findNode(kTree, "missing"), null);
  });
});

describe("Data.findParentId", () => {
  test("returns null for a root node", () => {
    assert.equal(findParentId(kTree, "a"), null);
  });

  test("returns the owning branch id", () => {
    assert.equal(findParentId(kTree, "a1"), "a");
    assert.equal(findParentId(kTree, "a2a"), "a2");
  });

  test("returns undefined for an unknown id", () => {
    assert.equal(findParentId(kTree, "missing"), undefined);
  });
});

describe("Data.ancestorChain", () => {
  test("is just the id for a root node", () => {
    assert.deepEqual(ancestorChain(kTree, "b"), ["b"]);
  });

  test("runs root first through the id itself for a nested node", () => {
    assert.deepEqual(ancestorChain(kTree, "a2a"), ["a", "a2", "a2a"]);
  });

  test("stops at the id itself for an unknown id", () => {
    assert.deepEqual(ancestorChain(kTree, "missing"), ["missing"]);
  });
});

describe("Data.hasChildren", () => {
  test("is false for a leaf without a children array", () => {
    assert.equal(hasChildren({ id: "b", label: "B" }), false);
  });

  test("is true when an empty children array marks a branch", () => {
    assert.equal(hasChildren({ id: "a", label: "A", children: [] }), true);
  });

  test("is true for a branch with at least one child", () => {
    assert.equal(hasChildren(kTree[0]), true);
  });
});

describe("Data.isExpandable", () => {
  test("is false for a leaf without a children array", () => {
    assert.equal(isExpandable({ id: "b", label: "B" }), false);
  });

  test("is false when the children array is empty", () => {
    assert.equal(isExpandable({ id: "a", label: "A", children: [] }), false);
  });

  test("is true for a branch with at least one child", () => {
    assert.equal(isExpandable(kTree[0]), true);
  });
});

describe("Data.isSelfOrDescendant", () => {
  test("is true for the node itself", () => {
    assert.equal(isSelfOrDescendant(kTree, "a", "a"), true);
  });

  test("is true for a direct child", () => {
    assert.equal(isSelfOrDescendant(kTree, "a", "a1"), true);
  });

  test("is true for a grandchild", () => {
    assert.equal(isSelfOrDescendant(kTree, "a", "a2a"), true);
  });

  test("is false for an unrelated node", () => {
    assert.equal(isSelfOrDescendant(kTree, "a", "b"), false);
  });

  test("is false for the node's own parent", () => {
    assert.equal(isSelfOrDescendant(kTree, "a2a", "a"), false);
  });

  test("is false when the ancestor id does not exist", () => {
    assert.equal(isSelfOrDescendant(kTree, "missing", "a"), false);
  });
});

describe("Data.resolveEdgeDropRows", () => {
  test("picks the first and last rows when nothing is moved", () => {
    const snapshot = new TreeSnapshot(kTree, new Set(["a", "a2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, [], snapshot),
      { firstRow: rows[0], lastRow: rows[rows.length - 1] }
    );
  });

  test("skips a moved row that is last in the tree", () => {
    const snapshot = new TreeSnapshot(kTree, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["b"], snapshot),
      { firstRow: rows[0], lastRow: rows[0] }
    );
  });

  test("skips a moved row that is first in the tree", () => {
    const snapshot = new TreeSnapshot(kTree, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["a"], snapshot),
      { firstRow: rows[1], lastRow: rows[1] }
    );
  });

  test("has no anchor rows left when every row is moved", () => {
    const snapshot = new TreeSnapshot(kTree, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["a", "b"], snapshot),
      { firstRow: undefined, lastRow: undefined }
    );
  });

  test("skips a moved branch's own children, not just the branch itself", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropRows(rows, ["r2"], snapshot),
      { firstRow: rows[0], lastRow: rows[0] }
    );
  });
});

describe("Data.resolveRootDropTarget", () => {
  test("targets the boundary row itself when it is already a root node", () => {
    assert.deepEqual(
      resolveRootDropTarget({
        nodes: kTree,
        movedIds: ["a2a"],
        rowId: "b",
        where: "below"
      }),
      { targetId: "b", where: "below" }
    );
  });

  test("climbs a nested boundary row up to its top-level ancestor", () => {
    assert.deepEqual(
      resolveRootDropTarget({
        nodes: kTree,
        movedIds: ["a1"],
        rowId: "a2a",
        where: "below"
      }),
      { targetId: "a", where: "below" }
    );
  });

  test("rejects a boundary row that is the moved branch's own child", () => {
    assert.equal(
      resolveRootDropTarget({
        nodes: kFolderTree,
        movedIds: ["r2"],
        rowId: "c2",
        where: "below"
      }),
      null
    );
  });

  test("still rejects dropping the moved node below itself", () => {
    assert.equal(
      resolveRootDropTarget({
        nodes: kTree,
        movedIds: ["b"],
        rowId: "b",
        where: "below"
      }),
      null
    );
  });
});

describe("Data.resolveEdgeDropTarget", () => {
  test("anchors at the true last row for an unrelated moved node", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: kFolderTree, movedIds: ["r1"], rows, where: "below" }, snapshot),
      { targetId: "r2", anchorId: "c2", where: "below" }
    );
  });

  test("anchors at the true first row for an unrelated moved node", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: kFolderTree, movedIds: ["c1"], rows, where: "above" }, snapshot),
      { targetId: "r1", anchorId: "r1", where: "above" }
    );
  });

  test("keeps the drop line at a dragged last row's own position, not the row before it", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: kFolderTree, movedIds: ["c2"], rows, where: "below" }, snapshot),
      { targetId: "r2", anchorId: "c2", where: "below" }
    );
  });

  test("falls back to a non-moved row when the edge row cannot climb anywhere new", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: kFolderTree, movedIds: ["r2"], rows, where: "below" }, snapshot),
      { targetId: "r1", anchorId: "r1", where: "below" }
    );
  });

  test("keeps the fallback anchored to a dragged root row itself, not the row before it", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set());
    const rows = snapshot.visibleRows;

    assert.deepEqual(
      resolveEdgeDropTarget({ nodes: kFolderTree, movedIds: ["r2"], rows, where: "below" }, snapshot),
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
    const snapshot = new TreeSnapshot(kTree, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a", where: "below" }),
      { rowId: "a", where: "below", depth: 0 }
    );
  });

  test("renders at the hovered row itself for 'above' and 'inside' too", () => {
    const snapshot = new TreeSnapshot(kTree, new Set(["a", "a2"]));

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
    const snapshot = new TreeSnapshot(kTree, new Set(["a", "a2"]));

    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { targetId: "a", anchorId: "a2a", where: "below" }),
      { rowId: "a2a", where: "below", depth: 0 }
    );
  });

  test("returns null when the target id is unknown", () => {
    const snapshot = new TreeSnapshot(kTree, new Set());

    assert.equal(
      resolveDropIndicatorRow(snapshot, { targetId: "missing", anchorId: "missing", where: "below" }),
      null
    );
  });

  test("dropping past a nested last row anchors to that row, not its root ancestor", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));
    const boundary = resolveRootDropTarget({
      nodes: kFolderTree,
      movedIds: ["r1"],
      rowId: "c2",
      where: "below"
    }, snapshot);

    assert.deepEqual(boundary, { targetId: "r2", where: "below" });
    assert.deepEqual(
      resolveDropIndicatorRow(snapshot, { ...boundary!, anchorId: "c2" }),
      { rowId: "c2", where: "below", depth: 0 }
    );
  });

  test("stays on the parent's own row when hovering it directly, not its last child", () => {
    const snapshot = new TreeSnapshot(kFolderTree, new Set(["r2"]));

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

describe("Data.TreeSnapshot", () => {
  test("indexes structure, ancestry, visibility, and stable order together", () => {
    const snapshot = new TreeSnapshot(kTree, new Set(["a", "a2"]));

    assert.equal(snapshot.node("a2a")?.label, "A2A");
    assert.equal(snapshot.parentId("a2a"), "a2");
    assert.deepEqual(snapshot.ancestorChain("a2a"), ["a", "a2", "a2a"]);
    assert.equal(snapshot.isSelfOrDescendant("a", "a2a"), true);
    assert.equal(snapshot.order("a2a"), 3);
    assert.deepEqual(
      snapshot.visibleRows.map((row) => row.node.id),
      ["a", "a1", "a2", "a2a", "b"]
    );
  });
});
