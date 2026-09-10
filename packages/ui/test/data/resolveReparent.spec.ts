// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  canDrop,
  resolveDepthDropTarget,
  resolveReparent
} from "../../src/data/resolveReparent.ts";
import { findNode } from "../../src/data/treeNodes.ts";
import type {
  JollyReparentDetail,
  TreeNode
} from "../../src/data/Tree.types.ts";

// CONSTANTS
function tree(): TreeNode[] {
  return [
    {
      id: "a",
      label: "A",
      children: [
        { id: "a1", label: "A1" },
        { id: "a2", label: "A2" }
      ]
    },
    { id: "b", label: "B" },
    { id: "c", label: "C" }
  ];
}

describe("Data.canDrop", () => {
  test("rejects dropping a node onto itself", () => {
    assert.equal(
      canDrop({ nodes: tree(), movedIds: ["a"], targetId: "a", where: "below" }),
      false
    );
  });

  test("rejects dropping a branch into its own descendant", () => {
    assert.equal(
      canDrop({ nodes: tree(), movedIds: ["a"], targetId: "a1", where: "inside" }),
      false
    );
  });

  test("allows an inside drop onto a leaf, which is how it becomes a branch", () => {
    assert.equal(
      canDrop({ nodes: tree(), movedIds: ["b"], targetId: "c", where: "inside" }),
      true
    );
  });

  test("allows an inside drop onto a branch", () => {
    assert.equal(
      canDrop({ nodes: tree(), movedIds: ["b"], targetId: "a", where: "inside" }),
      true
    );
  });

  test("allows moving one of several selected nodes past another selected node", () => {
    assert.equal(
      canDrop({ nodes: tree(), movedIds: ["b", "c"], targetId: "a", where: "below" }),
      true
    );
  });

  test("rejects when any moved id is an ancestor of the target", () => {
    assert.equal(
      canDrop({ nodes: tree(), movedIds: ["b", "a"], targetId: "a2", where: "above" }),
      false
    );
  });

  test("rejects a structurally valid move the domain veto refuses", () => {
    assert.equal(
      canDrop({
        nodes: tree(),
        movedIds: ["b"],
        targetId: "c",
        where: "below",
        accept: () => false
      }),
      false
    );
  });

  test("hands the domain veto the drop it is judging", () => {
    const seen: JollyReparentDetail[] = [];
    canDrop({
      nodes: tree(),
      movedIds: ["b"],
      targetId: "c",
      where: "inside",
      accept: (detail) => {
        seen.push(detail);

        return true;
      }
    });

    assert.deepEqual(seen, [
      {
        movedIds: ["b"],
        targetId: "c",
        where: "inside"
      }
    ]);
  });

  test("never consults the domain veto on a structurally impossible move", () => {
    let called = false;
    const rejected = canDrop({
      nodes: tree(),
      movedIds: ["a"],
      targetId: "a1",
      where: "inside",
      accept: () => {
        called = true;

        return true;
      }
    });

    assert.equal(rejected, false);
    assert.equal(called, false);
  });

  test("treats a null veto the same as an omitted one", () => {
    assert.equal(
      canDrop({
        nodes: tree(),
        movedIds: ["b"],
        targetId: "c",
        where: "below",
        accept: null
      }),
      true
    );
  });
});

describe("Data.resolveReparent", () => {
  test("returns the same reference for a rejected move", () => {
    const nodes = tree();
    const result = resolveReparent({ nodes, movedIds: ["a"], targetId: "a1", where: "inside" });

    assert.equal(result, nodes);
  });

  test("moves a root node above another root node", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["c"], targetId: "b", where: "above" });

    assert.deepEqual(result.map((node) => node.id), ["a", "c", "b"]);
  });

  test("moves a root node below another root node", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["a"], targetId: "b", where: "below" });

    assert.deepEqual(result.map((node) => node.id), ["b", "a", "c"]);
  });

  test("nests a root node inside a branch, appended after existing children", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["b"], targetId: "a", where: "inside" });

    assert.deepEqual(result.map((node) => node.id), ["a", "c"]);
    assert.deepEqual(
      findNode(result, "a")?.children?.map((node) => node.id),
      ["a1", "a2", "b"]
    );
  });

  test("moves a nested node out to root level", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["a1"], targetId: "b", where: "above" });

    assert.deepEqual(result.map((node) => node.id), ["a", "a1", "b", "c"]);
    assert.deepEqual(
      findNode(result, "a")?.children?.map((node) => node.id),
      ["a2"]
    );
  });

  test("moves several selected nodes together, preserving the order they were passed in", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["c", "b"], targetId: "a1", where: "above" });

    assert.deepEqual(result.map((node) => node.id), ["a"]);
    assert.deepEqual(
      findNode(result, "a")?.children?.map((node) => node.id),
      ["c", "b", "a1", "a2"]
    );
  });

  test("promotes a leaf to a branch on an inside drop", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["c"], targetId: "b", where: "inside" });

    assert.deepEqual(result.map((node) => node.id), ["a", "b"]);
    assert.deepEqual(
      findNode(result, "b")?.children?.map((node) => node.id),
      ["c"]
    );
  });

  test("leaves an empty children array on a branch emptied by the move", () => {
    const result = resolveReparent({ nodes: tree(), movedIds: ["a1", "a2"], targetId: "b", where: "above" });

    assert.deepEqual(findNode(result, "a")?.children, []);
  });
});

describe("Data.resolveDepthDropTarget", () => {
  test("promotes a dragged node to root when hovering the root's own band, below", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["a2"],
      rowId: "a2",
      clientX: 0,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.deepEqual(result, { targetId: "a", where: "below" });
  });

  test("promotes a dragged node to root when hovering the root's own band, above", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["a1"],
      rowId: "a1",
      clientX: 0,
      containerLeft: 0,
      indentUnit: 16,
      where: "above"
    });

    assert.deepEqual(result, { targetId: "a", where: "above" });
  });

  test("resolves to nothing in the dragged node's own band, which is a no-op", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["a2"],
      rowId: "a2",
      clientX: 16,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.equal(result, null);
  });

  test("clamps past the row's own depth to that same no-op band", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["a2"],
      rowId: "a2",
      clientX: 1000,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.equal(result, null);
  });

  test("targets the edge row itself when it is not the node being dragged, below", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["a1"],
      rowId: "c",
      clientX: 500,
      containerLeft: 0,
      indentUnit: 16,
      where: "below"
    });

    assert.deepEqual(result, { targetId: "c", where: "below" });
  });

  test("targets the edge row itself when it is not the node being dragged, above", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["c"],
      rowId: "a1",
      clientX: 500,
      containerLeft: 0,
      indentUnit: 16,
      where: "above"
    });

    assert.deepEqual(result, { targetId: "a1", where: "above" });
  });

  test("rejects a structurally valid depth drop the domain veto refuses", () => {
    const result = resolveDepthDropTarget({
      nodes: tree(),
      movedIds: ["a1"],
      rowId: "c",
      clientX: 500,
      containerLeft: 0,
      indentUnit: 16,
      where: "below",
      accept: () => false
    });

    assert.equal(result, null);
  });
});
