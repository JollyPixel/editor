// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import { BlockTransform } from "#src/model/nodes/BlockTransform.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import {
  TRANSFORM,
  UV,
  blockAdded,
  blockNode,
  folderAdded,
  folderNode
} from "../helpers/commands.ts";

function createTree(
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
    const tree = createTree(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      blockAdded("arm", "limbs")
    );

    assert.deepEqual(tree.toJSON().nodes, [
      blockNode("body"),
      folderNode("limbs", "body"),
      blockNode("arm", "limbs")
    ]);
    assert.deepEqual(
      tree.listChildren("body").map((node) => node.id),
      ["limbs"]
    );
    assert.deepEqual(
      tree.subtreeFrom("body").map((node) => node.id),
      ["body", "limbs", "arm"]
    );
  });

  test("derives the transform parent through folders", () => {
    const tree = createTree(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      folderAdded("left", "limbs"),
      blockAdded("arm", "left"),
      folderAdded("loose"),
      blockAdded("prop", "loose")
    );

    assert.equal(tree.findTransformParent("arm"), "body");
    assert.equal(tree.findTransformParent("prop"), null);
    assert.equal(tree.findTransformParent("body"), null);
    assert.equal(tree.findEnclosingBlock("left"), "body");
    assert.equal(tree.findEnclosingBlock("body"), "body");
    assert.equal(tree.findEnclosingBlock(null), null);
  });

  test("rejects an addition under an unknown parent or a known id", () => {
    const tree = createTree(blockAdded("a"));

    assert.equal(tree.accepts(blockAdded("a")), false);
    assert.equal(tree.accepts(blockAdded("b", "missing")), false);
    assert.equal(tree.accepts(blockAdded("b", "a")), true);
  });

  test("rejects edits of unknown nodes", () => {
    const tree = createTree(folderAdded("f"));

    assert.equal(tree.accepts({ action: "node-removed", id: "x" }), false);
    assert.equal(tree.accepts({ action: "node-renamed", id: "x", name: "X" }), false);
    assert.equal(
      tree.accepts({ action: "node-transformed", id: "f", transform: TRANSFORM }),
      false
    );
  });

  test("rejects a move into its own subtree or an unknown parent", () => {
    const tree = createTree(
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
    const tree = createTree(
      blockAdded("body"),
      folderAdded("limbs"),
      blockAdded("arm", "limbs")
    );
    const transform = BlockTransform.create({
      position: { x: 1, y: 2, z: 3 }
    });

    tree.apply({
      action: "node-moved",
      id: "limbs",
      parentId: "body",
      transforms: [{ id: "arm", transform }]
    });

    assert.equal(tree.get("limbs")?.parentId, "body");
    assert.equal(tree.findTransformParent("arm"), "body");
    assert.deepEqual(tree.block("arm")?.transform, transform);
  });

  test("places a moved node before a sibling, or last without one", () => {
    const tree = createTree(
      blockAdded("a"),
      folderAdded("f"),
      blockAdded("b"),
      blockAdded("c", "f")
    );

    tree.apply({
      action: "node-moved",
      id: "c",
      parentId: null,
      transforms: [],
      beforeId: "a"
    });
    assert.deepEqual(
      tree.listChildren(null).map((node) => node.id),
      ["c", "a", "f", "b"]
    );

    tree.apply({
      action: "node-moved",
      id: "a",
      parentId: null,
      transforms: []
    });
    assert.deepEqual(
      tree.listChildren(null).map((node) => node.id),
      ["c", "f", "b", "a"]
    );
  });

  test("places an added node before a sibling, and rejects a slot that is not one", () => {
    const tree = createTree(
      blockAdded("a"),
      folderAdded("f"),
      blockAdded("b", "f")
    );
    function addedBefore(
      beforeId: string
    ): VoxelModelCommand {
      return {
        action: "node-added",
        node: blockNode("c"),
        beforeId
      };
    }

    assert.equal(tree.accepts(addedBefore("b")), false);
    assert.equal(tree.accepts(addedBefore("missing")), false);
    tree.apply(addedBefore("f"));

    assert.deepEqual(
      tree.listChildren(null).map((node) => node.id),
      ["a", "c", "f"]
    );
  });

  test("rejects a move before a node that is not a sibling under the new parent", () => {
    const tree = createTree(
      folderAdded("f"),
      blockAdded("a"),
      blockAdded("b", "f")
    );

    function movedBefore(
      beforeId: string
    ): Extract<VoxelModelCommand, { action: "node-moved"; }> {
      return {
        action: "node-moved",
        id: "a",
        parentId: null,
        transforms: [],
        beforeId
      };
    }

    assert.equal(tree.accepts(movedBefore("f")), true);
    assert.equal(tree.accepts(movedBefore("a")), false);
    assert.equal(tree.accepts(movedBefore("b")), false);
    assert.equal(tree.accepts(movedBefore("missing")), false);
  });

  test("removes a node with its whole subtree", () => {
    const tree = createTree(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      blockAdded("arm", "limbs"),
      blockAdded("prop")
    );

    tree.apply({ action: "node-removed", id: "body" });

    assert.deepEqual(
      tree.toJSON().nodes.map((node) => node.id),
      ["prop"]
    );
  });

  test("records the flip axes of a mirrored block", () => {
    const tree = createTree(blockAdded("a"));
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

  test("stores the UV layout of a block", () => {
    const tree = createTree(blockAdded("a"));
    const command: VoxelModelCommand = {
      action: "node-uv-changed",
      id: "a",
      uv: UV
    };

    assert.equal(tree.accepts(command), true);
    tree.apply(command);

    assert.deepEqual(tree.block("a")?.uv, UV);
    assert.notStrictEqual(tree.block("a")?.uv, UV);
  });
});
