// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import { createBlockTransform } from "#src/model/blockTransform.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import {
  TRANSFORM,
  blockAdded,
  blockNode,
  folderAdded,
  folderNode
} from "../helpers/commands.ts";

function treeOf(
  ...commands: VoxelModelCommand[]
): ModelTree {
  const tree = new ModelTree();
  for (const command of commands) {
    assert.equal(tree.accepts(command), true);
    tree.apply(command);
  }

  return tree;
}

describe("ModelTree", () => {
  test("keeps blocks and folders in one tree", () => {
    const tree = treeOf(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      blockAdded("arm", "limbs")
    );

    assert.deepEqual(tree.toJSON(), [
      blockNode("body"),
      folderNode("limbs", "body"),
      blockNode("arm", "limbs")
    ]);
    assert.deepEqual(
      tree.childrenOf("body").map((node) => node.id),
      ["limbs"]
    );
    assert.deepEqual(
      tree.subtreeOf("body").map((node) => node.id),
      ["body", "limbs", "arm"]
    );
  });

  test("derives the transform parent through folders", () => {
    const tree = treeOf(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      folderAdded("left", "limbs"),
      blockAdded("arm", "left"),
      folderAdded("loose"),
      blockAdded("prop", "loose")
    );

    assert.equal(tree.transformParentOf("arm"), "body");
    assert.equal(tree.transformParentOf("prop"), null);
    assert.equal(tree.transformParentOf("body"), null);
    assert.equal(tree.enclosingBlockOf("left"), "body");
    assert.equal(tree.enclosingBlockOf("body"), "body");
    assert.equal(tree.enclosingBlockOf(null), null);
  });

  test("rejects an addition under an unknown parent or a known id", () => {
    const tree = treeOf(blockAdded("a"));

    assert.equal(tree.accepts(blockAdded("a")), false);
    assert.equal(tree.accepts(blockAdded("b", "missing")), false);
    assert.equal(tree.accepts(blockAdded("b", "a")), true);
  });

  test("rejects edits of unknown nodes", () => {
    const tree = treeOf(folderAdded("f"));

    assert.equal(tree.accepts({ action: "node-removed", id: "x" }), false);
    assert.equal(tree.accepts({ action: "node-renamed", id: "x", name: "X" }), false);
    assert.equal(
      tree.accepts({ action: "node-transformed", id: "f", transform: TRANSFORM }),
      false
    );
  });

  test("rejects a move into its own subtree or an unknown parent", () => {
    const tree = treeOf(
      folderAdded("a"),
      folderAdded("b", "a"),
      blockAdded("c", "b")
    );

    function moved(
      id: string,
      parentId: string | null
    ): Extract<VoxelModelCommand, { action: "node-moved"; }> {
      return {
        action: "node-moved",
        id,
        parentId,
        transforms: []
      };
    }

    assert.equal(tree.accepts(moved("a", "a")), false);
    assert.equal(tree.accepts(moved("a", "c")), false);
    assert.equal(tree.accepts(moved("a", "missing")), false);
    assert.equal(tree.accepts(moved("c", null)), true);
    assert.equal(
      tree.accepts({
        ...moved("c", null),
        transforms: [{ id: "b", transform: TRANSFORM }]
      }),
      false
    );
  });

  test("moves a node and rewrites the local transforms it carries", () => {
    const tree = treeOf(
      blockAdded("body"),
      folderAdded("limbs"),
      blockAdded("arm", "limbs")
    );
    const transform = createBlockTransform({
      position: { x: 1, y: 2, z: 3 }
    });

    tree.apply({
      action: "node-moved",
      id: "limbs",
      parentId: "body",
      transforms: [{ id: "arm", transform }]
    });

    assert.equal(tree.get("limbs")?.parentId, "body");
    assert.equal(tree.transformParentOf("arm"), "body");
    assert.deepEqual(tree.block("arm")?.transform, transform);
  });

  test("removes a node with its whole subtree", () => {
    const tree = treeOf(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      blockAdded("arm", "limbs"),
      blockAdded("prop")
    );

    tree.apply({ action: "node-removed", id: "body" });

    assert.deepEqual(
      tree.toJSON().map((node) => node.id),
      ["prop"]
    );
  });

  test("records the flip axes of a mirrored block", () => {
    const tree = treeOf(blockAdded("a"));
    const flipAxes = { x: true, y: false, z: false };

    tree.apply({
      action: "node-transformed",
      id: "a",
      transform: TRANSFORM,
      flipAxes
    });
    tree.apply({ action: "node-transformed", id: "a", transform: TRANSFORM });

    assert.deepEqual(tree.block("a")?.flipAxes, flipAxes);
  });

  test("hands out copies", () => {
    const tree = treeOf(blockAdded("a"));

    const node = blockNode("a");
    const loaded = new ModelTree();
    loaded.load([node]);

    assert.notStrictEqual(tree.block("a"), tree.block("a"));
    assert.notStrictEqual(loaded.block("a"), node);
    assert.deepEqual(loaded.block("a"), node);
  });
});
