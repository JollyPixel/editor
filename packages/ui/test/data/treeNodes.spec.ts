// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  findNode,
  findParentId,
  flattenVisible,
  isSelfOrDescendant
} from "../../src/data/treeNodes.ts";
import type { TreeNode } from "../../src/data/Tree.types.ts";

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
