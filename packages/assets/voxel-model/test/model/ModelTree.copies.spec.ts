// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import { blockAdded, blockNode } from "../helpers/commands.ts";

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
  test("hands out copies", () => {
    const tree = createTree(blockAdded("a"));

    const node = blockNode("a");
    const loaded = new ModelTree();
    loaded.load({ nodes: [node], materials: [], animationSets: [] });

    assert.notStrictEqual(tree.block("a"), tree.block("a"));
    assert.notStrictEqual(loaded.block("a"), node);
    assert.deepEqual(loaded.block("a"), node);
  });
});
