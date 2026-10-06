// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import {
  blockNameClashes,
  blockNameTaken,
  freeBlockName
} from "#src/model/blockNames.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import {
  blockAdded,
  folderAdded
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

function renamed(
  id: string,
  name: string
): VoxelModelCommand {
  return {
    action: "node-renamed",
    id,
    name
  };
}

describe("block names", () => {
  test("compares names among blocks sharing a block parent, through folders", () => {
    const tree = treeOf(
      blockAdded("body"),
      blockAdded("arm", "body"),
      folderAdded("limbs", "body"),
      blockAdded("leg", "limbs")
    );

    assert.equal(blockNameTaken(tree, " ARM ", "body"), true);
    assert.equal(blockNameTaken(tree, "arm", "limbs"), true);
    assert.equal(blockNameTaken(tree, "leg", "body"), true);
    assert.equal(blockNameTaken(tree, "arm", null), false);
    assert.equal(blockNameTaken(tree, "arm", "arm"), false);
    assert.equal(blockNameTaken(tree, "arm", "body", "arm"), false);
    assert.equal(blockNameTaken(tree, "limbs", "body"), false);
  });

  test("picks the first free numbered name", () => {
    const tree = treeOf(
      blockAdded("body"),
      blockAdded("a", "body"),
      blockAdded("b", "body"),
      renamed("a", "Block"),
      renamed("b", "Block 2")
    );

    assert.equal(freeBlockName(tree, "Head", "body"), "Head");
    assert.equal(freeBlockName(tree, "block", "body"), "block 3");
    assert.equal(freeBlockName(tree, "Block 2", "body"), "Block 3");
    assert.equal(freeBlockName(tree, "Block", null), "Block");
  });

  test("accepts clashing names and reports every block involved", () => {
    const tree = treeOf(
      blockAdded("body"),
      blockAdded("a", "body"),
      folderAdded("limbs", "body"),
      blockAdded("b", "limbs"),
      blockAdded("c", "body"),
      blockAdded("d"),
      renamed("a", "arm"),
      renamed("b", "Arm"),
      renamed("d", "arm")
    );

    assert.deepEqual(blockNameClashes(tree), new Set(["a", "b"]));
  });
});
