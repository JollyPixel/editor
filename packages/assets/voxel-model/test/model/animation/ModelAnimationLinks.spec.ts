// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import {
  blockAdded,
  folderAdded
} from "../../helpers/commands.ts";

// CONSTANTS
const kLink = { id: "walk", kind: "voxelanimation", bindings: [] };

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

describe("ModelTree animation set links", () => {
  test("links once, remaps tracks, any case of a path being one track, and unlinks", () => {
    const tree = treeOf(
      blockAdded("arm"),
      { action: "animation-set-linked", link: kLink },
      { action: "animation-binding-changed", id: "walk", path: "Arm", target: "Hand" },
      { action: "animation-binding-changed", id: "walk", path: "Tail", target: null },
      { action: "animation-binding-changed", id: "walk", path: "tail", target: "Wing" },
      { action: "animation-binding-cleared", id: "walk", path: "ARM" }
    );

    assert.deepEqual(tree.animationSets.get("walk")?.bindings, [{ path: "tail", target: "Wing" }]);
    assert.equal(tree.accepts({ action: "animation-set-linked", link: kLink }), false);

    tree.apply({ action: "animation-set-unlinked", id: "walk" });
    assert.equal(tree.animationSets.size, 0);
  });

  test("refuses remap commands on a set that is not linked", () => {
    const tree = treeOf(
      folderAdded("limbs"),
      { action: "animation-set-linked", link: kLink }
    );

    const remap = { action: "animation-binding-changed", path: "A" } as const;

    assert.equal(tree.accepts({ ...remap, id: "walk", target: "B" }), true);
    assert.equal(tree.accepts({ ...remap, id: "run", target: null }), false);
    assert.equal(tree.accepts({ action: "animation-binding-cleared", id: "run", path: "A" }), false);
    assert.equal(tree.accepts({ action: "animation-set-unlinked", id: "run" }), false);
  });

  test("returns the link a link command is about to replace", () => {
    const tree = treeOf({ action: "animation-set-linked", link: kLink });
    const relink: VoxelModelCommand = {
      action: "animation-set-linked",
      link: { ...kLink, id: "run" }
    };

    assert.deepEqual(tree.imagesOf({ action: "animation-set-unlinked", id: "walk" }).animationSets, [kLink]);
    assert.deepEqual(tree.imagesOf(relink).animationSets, []);
  });

  test("owns one set at most, and shares it back", () => {
    const tree = treeOf({ action: "animation-set-linked", link: { ...kLink, own: true } });
    const run = { ...kLink, id: "run" };

    assert.equal(tree.animationSets.owned?.id, "walk");
    assert.equal(tree.accepts({ action: "animation-set-linked", link: { ...run, own: true } }), false);
    tree.apply({ action: "animation-set-linked", link: run });
    assert.equal(tree.accepts({ action: "animation-set-owned", id: "run", own: true }), false);
    assert.equal(tree.accepts({ action: "animation-set-owned", id: "walk", own: true }), true);

    tree.apply({ action: "animation-set-owned", id: "walk", own: false });
    assert.equal(tree.animationSets.owned, undefined);
    assert.deepEqual(tree.animationSets.get("walk"), kLink);
    assert.equal(tree.accepts({ action: "animation-set-owned", id: "run", own: true }), true);
  });

  test("refuses to load a model owning two sets", () => {
    const tree = new ModelTree();
    const own = { ...kLink, own: true };

    assert.throws(
      () => tree.load({ nodes: [], materials: [], animationSets: [own, { ...own, id: "run" }] }),
      /second own set/
    );
  });
});
