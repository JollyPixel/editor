// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import type { VoxelModelCommand, VoxelModelSnapshot } from "#src/network/types.ts";
import {
  TRANSFORM,
  blockAdded,
  blockNode,
  folderAdded,
  folderNode,
  material,
  materialAdded,
  materialFolder,
  materialFolderAdded
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

describe("ModelTree.load", () => {
  test("loads a child listed before its parent", () => {
    const tree = new ModelTree();

    tree.load({
      nodes: [blockNode("arm", "body"), blockNode("body")],
      materials: [],
      animationSets: []
    });

    assert.equal(tree.get("arm")?.parentId, "body");
  });

  test("rejects a repeated id, a missing parent or material and a cycle", () => {
    const link = { id: "walk", kind: "voxelanimation", bindings: [] };
    const cases: Partial<VoxelModelSnapshot>[] = [
      { nodes: [blockNode("a"), folderNode("a")] },
      { nodes: [blockNode("a", "ghost")] },
      { nodes: [folderNode("a", "b"), folderNode("b", "a")] },
      { nodes: [folderNode("a", "a")] },
      { nodes: [{ ...blockNode("a"), materialId: "ghost" }], materials: [material("glass")] },
      { materials: [material("glass"), material("glass")] },
      { materials: [material("glass"), material("steel", "glass")] },
      { materials: [material("steel", "ghost")] },
      { materials: [materialFolder("a", "b"), materialFolder("b", "a")] },
      { nodes: [{ ...blockNode("a"), materialId: "metals" }], materials: [materialFolder("metals")] },
      { animationSets: [link, link] },
      {
        animationSets: [{
          ...link,
          bindings: [{ path: "arm", target: null }, { path: "ARM", target: "Hand" }]
        }]
      }
    ];

    for (const snapshot of cases) {
      assert.throws(
        () => new ModelTree().load({
          nodes: [],
          materials: [],
          animationSets: [],
          ...snapshot
        }),
        InvalidEntryError
      );
    }
  });

  test("keeps the current nodes and materials when a load is rejected", () => {
    const tree = createTree(materialAdded("glass"), blockAdded("body"));

    assert.throws(() => tree.load({
      nodes: [blockNode("a", "ghost")],
      materials: [material("metal")],
      animationSets: []
    }));

    assert.ok(tree.has("body"));
    assert.equal(tree.has("a"), false);
    assert.ok(tree.materials.has("glass"));
    assert.equal(tree.materials.has("metal"), false);
  });
});

describe("ModelTree.captureImages", () => {
  test("returns the nodes a command changes, as they are before it", () => {
    const tree = createTree(
      folderAdded("f"),
      blockAdded("a", "f"),
      blockAdded("b")
    );

    assert.deepEqual(tree.captureImages(blockAdded("c")).nodes, []);
    assert.deepEqual(
      tree.captureImages({ action: "node-removed", id: "f" }).nodes.map((node) => node.id),
      ["f", "a"]
    );
    assert.deepEqual(
      tree.captureImages({
        action: "node-moved",
        id: "a",
        parentId: null,
        transforms: [{ id: "a", transform: TRANSFORM }, { id: "b", transform: TRANSFORM }]
      }).nodes.map((node) => node.id),
      ["a", "b"]
    );
    assert.deepEqual(
      tree.captureImages({ action: "node-renamed", id: "b", name: "B" }),
      { nodes: [blockNode("b")], materials: [], animationSets: [] }
    );
    assert.deepEqual(
      tree.captureImages({ action: "node-renamed", id: "missing", name: "B" }).nodes,
      []
    );
  });

  test("returns the blocks a material removal clears", () => {
    const tree = createTree(
      materialFolderAdded("metals"),
      materialAdded("iron", "metals"),
      materialAdded("glass"),
      { action: "node-added", node: { ...blockNode("a"), materialId: "iron" } },
      { action: "node-added", node: { ...blockNode("b"), materialId: "glass" } }
    );

    assert.deepEqual(
      tree.captureImages({ action: "material-removed", id: "metals" }).nodes.map((node) => node.id),
      ["a"]
    );
    assert.deepEqual(
      tree.captureImages({ action: "material-removed", id: "metals", keepContents: true }).nodes,
      []
    );
    assert.deepEqual(
      tree.captureImages({ action: "material-renamed", id: "glass", name: "Glass" }).nodes,
      []
    );
  });

  test("returns the library entries a command changes, as they are before it", () => {
    const tree = createTree(
      materialFolderAdded("metals"),
      materialAdded("iron", "metals"),
      materialAdded("glass")
    );
    function readMaterials(
      command: VoxelModelCommand
    ): unknown {
      return tree.captureImages(command).materials;
    }

    assert.deepEqual(readMaterials(materialAdded("gold")), []);
    assert.deepEqual(readMaterials(blockAdded("a")), []);
    assert.deepEqual(
      readMaterials({ action: "material-removed", id: "metals" }),
      [materialFolder("metals"), material("iron", "metals")]
    );
    assert.deepEqual(
      readMaterials({ action: "material-removed", id: "metals", keepContents: true }),
      [materialFolder("metals"), material("iron", "metals")]
    );
    assert.deepEqual(
      readMaterials({ action: "material-changed", id: "glass", surface: { opacity: 0.5 } }),
      [material("glass")]
    );
    assert.deepEqual(
      readMaterials({ action: "material-moved", id: "missing", parentId: null }),
      []
    );
  });
});

describe("ModelTree.placeable", () => {
  test("keeps a beforeId the tree would accept and drops one it would refuse", () => {
    const tree = createTree(
      folderAdded("limbs"),
      blockAdded("arm", "limbs"),
      blockAdded("body"),
      materialAdded("iron")
    );

    const leg = blockNode("leg", "limbs");
    const kept: VoxelModelCommand = { action: "node-added", node: leg, beforeId: "arm" };
    const stale: VoxelModelCommand = { action: "node-added", node: leg, beforeId: "body" };

    assert.deepEqual(tree.placeable(kept), kept);
    assert.deepEqual(tree.placeable(stale), { action: "node-added", node: leg });
    assert.equal(tree.accepts(stale), false);
    assert.equal(tree.accepts(tree.placeable(stale)), true);
    const move: VoxelModelCommand = {
      action: "node-moved",
      id: "body",
      parentId: "limbs",
      transforms: [],
      beforeId: "gone"
    };
    assert.deepEqual(
      tree.placeable(move),
      { action: "node-moved", id: "body", parentId: "limbs", transforms: [] }
    );
    assert.deepEqual(
      tree.placeable({ action: "material-moved", id: "iron", parentId: null, beforeId: "iron" }),
      { action: "material-moved", id: "iron", parentId: null }
    );
  });
});

describe("ModelTree block names", () => {
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

  test("compares names among blocks sharing a block parent, through folders", () => {
    const tree = createTree(
      blockAdded("body"),
      blockAdded("arm", "body"),
      folderAdded("limbs", "body"),
      blockAdded("leg", "limbs")
    );

    assert.equal(tree.blockNamesUnder("body").has(" ARM "), true);
    assert.equal(tree.blockNamesUnder("limbs").has("arm"), true);
    assert.equal(tree.blockNamesUnder("body").has("leg"), true);
    assert.equal(tree.blockNamesUnder(null).has("arm"), false);
    assert.equal(tree.blockNamesUnder("arm").has("arm"), false);
    assert.equal(tree.blockNamesUnder("body", "arm").has("arm"), false);
    assert.equal(tree.blockNamesUnder("body").has("limbs"), false);
  });

  test("picks the first free numbered name among the siblings only", () => {
    const tree = createTree(
      blockAdded("body"),
      blockAdded("a", "body"),
      blockAdded("b", "body"),
      renamed("a", "Block"),
      renamed("b", "Block 2")
    );

    assert.equal(tree.blockNamesUnder("body").free("block"), "block 3");
    assert.equal(tree.blockNamesUnder(null).free("Block"), "Block");
  });

  test("accepts clashing names and reports every block involved", () => {
    const tree = createTree(
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

    assert.deepEqual(tree.blockNameClashes(), new Set(["a", "b"]));
  });
});
