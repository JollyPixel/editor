// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  canDrop,
  findNode,
  resolveReparent,
  resolveReparentMoves
} from "../../src/data/tree/model.ts";
import type { JollyReparentDetail } from "../../src/data/tree/contract.ts";
import { reparentTree } from "../fixtures/tree.ts";

describe("Data.canDrop", () => {
  test("rejects dropping a node onto itself", () => {
    assert.equal(
      canDrop({ nodes: reparentTree(), movedIds: ["a"], targetId: "a", where: "below" }),
      false
    );
  });

  test("rejects dropping a branch into its own descendant", () => {
    assert.equal(
      canDrop({ nodes: reparentTree(), movedIds: ["a"], targetId: "a1", where: "inside" }),
      false
    );
  });

  test("allows an inside drop onto a leaf, which is how it becomes a branch", () => {
    assert.equal(
      canDrop({ nodes: reparentTree(), movedIds: ["b"], targetId: "c", where: "inside" }),
      true
    );
  });

  test("allows an inside drop onto a branch", () => {
    assert.equal(
      canDrop({ nodes: reparentTree(), movedIds: ["b"], targetId: "a", where: "inside" }),
      true
    );
  });

  test("allows moving one of several selected nodes past another selected node", () => {
    assert.equal(
      canDrop({ nodes: reparentTree(), movedIds: ["b", "c"], targetId: "a", where: "below" }),
      true
    );
  });

  test("rejects when any moved id is an ancestor of the target", () => {
    assert.equal(
      canDrop({ nodes: reparentTree(), movedIds: ["b", "a"], targetId: "a2", where: "above" }),
      false
    );
  });

  test("rejects a structurally valid move the domain veto refuses", () => {
    assert.equal(
      canDrop({
        nodes: reparentTree(),
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
      nodes: reparentTree(),
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
      nodes: reparentTree(),
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
        nodes: reparentTree(),
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
    const nodes = reparentTree();
    const result = resolveReparent({ nodes, movedIds: ["a"], targetId: "a1", where: "inside" });

    assert.equal(result, nodes);
  });

  test("moves a root node above another root node", () => {
    const result = resolveReparent({ nodes: reparentTree(), movedIds: ["c"], targetId: "b", where: "above" });

    assert.deepEqual(result.map((node) => node.id), ["a", "c", "b"]);
  });

  test("moves a root node below another root node", () => {
    const result = resolveReparent({ nodes: reparentTree(), movedIds: ["a"], targetId: "b", where: "below" });

    assert.deepEqual(result.map((node) => node.id), ["b", "a", "c"]);
  });

  test("nests a root node inside a branch, appended after existing children", () => {
    const result = resolveReparent({
      nodes: reparentTree(),
      movedIds: ["b"],
      targetId: "a",
      where: "inside"
    });

    assert.deepEqual(result.map((node) => node.id), ["a", "c"]);
    assert.deepEqual(
      findNode(result, "a")?.children?.map((node) => node.id),
      ["a1", "a2", "b"]
    );
  });

  test("moves a nested node out to root level", () => {
    const result = resolveReparent({
      nodes: reparentTree(),
      movedIds: ["a1"],
      targetId: "b",
      where: "above"
    });

    assert.deepEqual(result.map((node) => node.id), ["a", "a1", "b", "c"]);
    assert.deepEqual(
      findNode(result, "a")?.children?.map((node) => node.id),
      ["a2"]
    );
  });

  test("moves several selected nodes together, preserving the order they were passed in", () => {
    const result = resolveReparent({
      nodes: reparentTree(),
      movedIds: ["c", "b"],
      targetId: "a1",
      where: "above"
    });

    assert.deepEqual(result.map((node) => node.id), ["a"]);
    assert.deepEqual(
      findNode(result, "a")?.children?.map((node) => node.id),
      ["c", "b", "a1", "a2"]
    );
  });

  test("promotes a leaf to a branch on an inside drop", () => {
    const result = resolveReparent({
      nodes: reparentTree(),
      movedIds: ["c"],
      targetId: "b",
      where: "inside"
    });

    assert.deepEqual(result.map((node) => node.id), ["a", "b"]);
    assert.deepEqual(
      findNode(result, "b")?.children?.map((node) => node.id),
      ["c"]
    );
  });

  test("leaves an empty children array on a branch emptied by the move", () => {
    const result = resolveReparent({
      nodes: reparentTree(),
      movedIds: ["a1", "a2"],
      targetId: "b",
      where: "above"
    });

    assert.deepEqual(findNode(result, "a")?.children, []);
  });
});

describe("Data.resolveReparentMoves", () => {
  test("moves each node last-first, before a sibling already in place", () => {
    assert.deepEqual(
      resolveReparentMoves({ nodes: reparentTree(), movedIds: ["b", "c"], targetId: "a1", where: "above" }),
      [
        { id: "c", parentId: "a", beforeId: "a1" },
        { id: "b", parentId: "a", beforeId: "c" }
      ]
    );
  });

  test("lands a node last inside a target without a sibling after it", () => {
    assert.deepEqual(
      resolveReparentMoves({ nodes: reparentTree(), movedIds: ["c"], targetId: "a", where: "inside" }),
      [{ id: "c", parentId: "a" }]
    );
  });

  test("gives no moves for a refused drop", () => {
    assert.deepEqual(
      resolveReparentMoves({ nodes: reparentTree(), movedIds: ["a"], targetId: "a1", where: "inside" }),
      []
    );
  });
});
