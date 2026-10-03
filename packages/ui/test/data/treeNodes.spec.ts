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
  TreeSnapshot
} from "../../src/data/tree/model.ts";
import type { TreeNode } from "../../src/data/tree/contract.ts";
import { TREE } from "../fixtures/tree.ts";

describe("Data.flattenVisible", () => {
  test("skips a collapsed branch's children", () => {
    const rows = flattenVisible(TREE, new Set());

    assert.deepEqual(
      rows.map((row) => row.node.id),
      ["a", "b"]
    );
  });

  test("includes an expanded branch's children, depth first", () => {
    const rows = flattenVisible(TREE, new Set(["a"]));

    assert.deepEqual(
      rows.map((row) => row.node.id),
      ["a", "a1", "a2", "b"]
    );
  });

  test("nests through several expanded levels", () => {
    const rows = flattenVisible(TREE, new Set(["a", "a2"]));

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
    const rows = flattenVisible(TREE, new Set(["a", "a2"]));

    assert.deepEqual(
      rows.map((row) => row.parentId),
      [null, "a", "a", "a2", null]
    );
  });

  test("shows a non-collapsible branch's children without expanding it", () => {
    const nodes: TreeNode[] = [
      {
        id: "owner",
        label: "Owner",
        collapsible: false,
        children: [{ id: "companion", label: "Companion" }]
      }
    ];
    const rows = flattenVisible(nodes, new Set());

    assert.deepEqual(
      rows.map((row) => [row.node.id, row.depth]),
      [["owner", 0], ["companion", 1]]
    );
  });
});

describe("Data.findNode", () => {
  test("finds a top-level node", () => {
    assert.equal(findNode(TREE, "b")?.label, "B");
  });

  test("finds a node nested under a collapsed branch", () => {
    assert.equal(findNode(TREE, "a2a")?.label, "A2A");
  });

  test("returns null for an unknown id", () => {
    assert.equal(findNode(TREE, "missing"), null);
  });
});

describe("Data.findParentId", () => {
  test("returns null for a root node", () => {
    assert.equal(findParentId(TREE, "a"), null);
  });

  test("returns the owning branch id", () => {
    assert.equal(findParentId(TREE, "a1"), "a");
    assert.equal(findParentId(TREE, "a2a"), "a2");
  });

  test("returns undefined for an unknown id", () => {
    assert.equal(findParentId(TREE, "missing"), undefined);
  });
});

describe("Data.ancestorChain", () => {
  test("is just the id for a root node", () => {
    assert.deepEqual(ancestorChain(TREE, "b"), ["b"]);
  });

  test("runs root first through the id itself for a nested node", () => {
    assert.deepEqual(ancestorChain(TREE, "a2a"), ["a", "a2", "a2a"]);
  });

  test("stops at the id itself for an unknown id", () => {
    assert.deepEqual(ancestorChain(TREE, "missing"), ["missing"]);
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
    assert.equal(hasChildren(TREE[0]), true);
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
    assert.equal(isExpandable(TREE[0]), true);
  });

  test("is false for a non-collapsible branch", () => {
    assert.equal(isExpandable({ ...TREE[0], collapsible: false }), false);
  });
});

describe("Data.isSelfOrDescendant", () => {
  test("is true for the node itself", () => {
    assert.equal(isSelfOrDescendant(TREE, "a", "a"), true);
  });

  test("is true for a direct child", () => {
    assert.equal(isSelfOrDescendant(TREE, "a", "a1"), true);
  });

  test("is true for a grandchild", () => {
    assert.equal(isSelfOrDescendant(TREE, "a", "a2a"), true);
  });

  test("is false for an unrelated node", () => {
    assert.equal(isSelfOrDescendant(TREE, "a", "b"), false);
  });

  test("is false for the node's own parent", () => {
    assert.equal(isSelfOrDescendant(TREE, "a2a", "a"), false);
  });

  test("is false when the ancestor id does not exist", () => {
    assert.equal(isSelfOrDescendant(TREE, "missing", "a"), false);
  });
});

describe("Data.TreeSnapshot", () => {
  test("indexes structure, ancestry, visibility, and stable order together", () => {
    const snapshot = new TreeSnapshot(TREE, new Set(["a", "a2"]));

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

  test("reports branches even when they are collapsed", () => {
    assert.equal(new TreeSnapshot(TREE).hasBranches, true);
  });

  test("reports no branches for a flat list or empty children", () => {
    const flat: TreeNode[] = [
      { id: "x", label: "X" },
      { id: "y", label: "Y", children: [] }
    ];

    assert.equal(new TreeSnapshot(flat).hasBranches, false);
  });
});
