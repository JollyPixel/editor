// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import { InvalidModelTreeError } from "#src/model/InvalidModelTreeError.ts";
import { createBlockTransform } from "#src/model/blockTransform.ts";
import { createMaterialSurface } from "#src/model/materialSurface.ts";
import type {
  VoxelModelCommand,
  VoxelModelSnapshot
} from "#src/network/types.ts";
import {
  TRANSFORM,
  UV,
  blockAdded,
  blockNode,
  folderAdded,
  folderNode,
  material,
  materialAdded,
  materialFolder,
  materialFolderAdded
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

    assert.deepEqual(tree.toJSON().nodes, [
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

  test("places a moved node before a sibling, or last without one", () => {
    const tree = treeOf(
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
      tree.childrenOf(null).map((node) => node.id),
      ["c", "a", "f", "b"]
    );

    tree.apply({
      action: "node-moved",
      id: "a",
      parentId: null,
      transforms: []
    });
    assert.deepEqual(
      tree.childrenOf(null).map((node) => node.id),
      ["c", "f", "b", "a"]
    );
  });

  test("places an added node before a sibling, and rejects a slot that is not one", () => {
    const tree = treeOf(
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
      tree.childrenOf(null).map((node) => node.id),
      ["a", "c", "f"]
    );
  });

  test("rejects a move before a node that is not a sibling under the new parent", () => {
    const tree = treeOf(
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
    const tree = treeOf(
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

  test("stores the UV layout of a block", () => {
    const tree = treeOf(blockAdded("a"));
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

  test("rejects a UV layout for a folder or an unknown node", () => {
    const tree = treeOf(folderAdded("f"));

    assert.equal(
      tree.accepts({ action: "node-uv-changed", id: "f", uv: UV }),
      false
    );
    assert.equal(
      tree.accepts({ action: "node-uv-changed", id: "missing", uv: UV }),
      false
    );
  });

  test("points a block to a material and back to none", () => {
    const tree = treeOf(materialAdded("glass"), blockAdded("a"));

    tree.apply({ action: "node-material-changed", id: "a", materialId: "glass" });
    assert.equal(tree.block("a")?.materialId, "glass");

    tree.apply({ action: "node-material-changed", id: "a", materialId: null });
    assert.equal("materialId" in (tree.block("a") ?? {}), false);
  });

  test("rejects a material for a folder, an unknown node or an unknown material", () => {
    const tree = treeOf(materialAdded("glass"), folderAdded("f"), blockAdded("a"));

    assert.equal(
      tree.accepts({ action: "node-material-changed", id: "f", materialId: "glass" }),
      false
    );
    assert.equal(
      tree.accepts({ action: "node-material-changed", id: "missing", materialId: null }),
      false
    );
    assert.equal(
      tree.accepts({ action: "node-material-changed", id: "a", materialId: "ghost" }),
      false
    );
    assert.equal(
      tree.accepts({
        action: "node-added",
        node: { ...blockNode("b"), materialId: "ghost" }
      }),
      false
    );
  });

  test("renames and resurfaces a material, and rejects a repeated or unknown id", () => {
    const tree = treeOf(materialAdded("glass"));

    tree.apply({ action: "material-renamed", id: "glass", name: "Chrome" });
    tree.apply({ action: "material-changed", id: "glass", surface: { metalness: 1 } });
    tree.apply({ action: "material-changed", id: "glass", surface: { roughness: 0.2 } });

    assert.deepEqual(tree.materials.get("glass"), {
      ...material("glass"),
      name: "Chrome",
      surface: createMaterialSurface({ metalness: 1, roughness: 0.2 })
    });
    assert.equal(
      tree.accepts({ action: "material-changed", id: "glass", surface: {} }),
      false
    );
    assert.equal(tree.accepts(materialAdded("glass")), false);
    assert.equal(
      tree.accepts({ action: "material-renamed", id: "ghost", name: "x" }),
      false
    );
    assert.equal(tree.accepts({ action: "material-removed", id: "ghost" }), false);
  });

  test("leaves the blocks of a removed material without one", () => {
    const tree = treeOf(
      materialAdded("glass"),
      materialAdded("metal"),
      { action: "node-added", node: { ...blockNode("a"), materialId: "glass" } },
      { action: "node-added", node: { ...blockNode("b"), materialId: "metal" } }
    );

    tree.apply({ action: "material-removed", id: "glass" });

    assert.equal(tree.materials.has("glass"), false);
    assert.equal(tree.block("a")?.materialId, undefined);
    assert.equal(tree.block("b")?.materialId, "metal");
  });

  test("nests materials in folders and orders siblings", () => {
    const tree = treeOf(
      materialFolderAdded("metals"),
      materialAdded("glass"),
      materialAdded("steel", "metals"),
      { action: "material-added", material: material("gold", "metals"), beforeId: "steel" }
    );

    tree.apply({ action: "material-moved", id: "glass", parentId: "metals", beforeId: "gold" });

    assert.deepEqual(
      tree.materials.childrenOf("metals").map(({ id }) => id),
      ["glass", "gold", "steel"]
    );
    assert.deepEqual(tree.materials.childrenOf(null).map(({ id }) => id), ["metals"]);
    assert.deepEqual([...tree.materials.materials()].map(({ id }) => id), ["glass", "gold", "steel"]);
  });

  test("reads the material of a block, and none for a folder or an unknown id", () => {
    const tree = treeOf(
      materialAdded("glass"),
      { action: "node-added", node: { ...blockNode("body"), materialId: "glass" } },
      blockAdded("arm"),
      folderAdded("limbs")
    );

    assert.equal(tree.materialIdOf("body"), "glass");
    assert.equal(tree.materialIdOf("arm"), undefined);
    assert.equal(tree.materialIdOf("limbs"), undefined);
    assert.equal(tree.materialIdOf("missing"), undefined);
    assert.deepEqual(tree.blocksUsing("glass"), ["body"]);
    assert.deepEqual(tree.blocksUsing("missing"), []);
  });

  test("finds the next sibling of a node or material, skipping other parents", () => {
    const tree = treeOf(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      blockAdded("head"),
      materialFolderAdded("metals"),
      materialAdded("steel", "metals"),
      materialAdded("glass"),
      materialAdded("gold", "metals")
    );

    assert.equal(tree.nextSiblingOf("body"), "head");
    assert.equal(tree.nextSiblingOf("head"), undefined);
    assert.equal(tree.nextSiblingOf("missing"), undefined);
    assert.equal(tree.materials.nextSiblingOf("steel"), "gold");
    assert.equal(tree.materials.nextSiblingOf("metals"), "glass");
  });

  test("rejects a material parent that is not a folder, a cycle and a foreign sibling", () => {
    const tree = treeOf(
      materialFolderAdded("metals"),
      materialFolderAdded("alloys", "metals"),
      materialAdded("glass"),
      blockAdded("a")
    );

    const rejected: VoxelModelCommand[] = [
      materialAdded("steel", "glass"),
      materialFolderAdded("rare", "ghost"),
      { action: "material-moved", id: "metals", parentId: "alloys" },
      { action: "material-moved", id: "metals", parentId: "metals" },
      { action: "material-moved", id: "glass", parentId: "metals", beforeId: "glass" },
      { action: "material-moved", id: "glass", parentId: null, beforeId: "alloys" },
      { action: "material-changed", id: "metals", surface: createMaterialSurface() },
      { action: "node-material-changed", id: "a", materialId: "metals" }
    ];

    for (const command of rejected) {
      assert.equal(tree.accepts(command), false, command.action);
    }
    assert.equal(
      tree.accepts({ action: "material-moved", id: "alloys", parentId: null, beforeId: "glass" }),
      true
    );
  });

  test("removes a folder with its content and leaves the blocks of its materials without one", () => {
    const tree = treeOf(
      materialFolderAdded("metals"),
      materialFolderAdded("alloys", "metals"),
      materialAdded("bronze", "alloys"),
      materialAdded("glass"),
      { action: "node-added", node: { ...blockNode("a"), materialId: "bronze" } },
      { action: "node-added", node: { ...blockNode("b"), materialId: "glass" } }
    );

    tree.apply({ action: "material-removed", id: "metals" });

    assert.deepEqual([...tree.materials.values()].map(({ id }) => id), ["glass"]);
    assert.equal(tree.block("a")?.materialId, undefined);
    assert.equal(tree.block("b")?.materialId, "glass");
  });

  test("removes a folder alone and puts its contents in its place, keeping their blocks", () => {
    const tree = treeOf(
      materialAdded("glass"),
      materialFolderAdded("metals"),
      materialAdded("steel", "metals"),
      materialAdded("gold", "metals"),
      materialAdded("wood"),
      { action: "node-added", node: { ...blockNode("a"), materialId: "steel" } }
    );

    tree.apply({ action: "material-removed", id: "metals", keepContents: true });

    assert.deepEqual(
      [...tree.materials.values()].map(({ id, parentId }) => [id, parentId]),
      [["glass", null], ["steel", null], ["gold", null], ["wood", null]]
    );
    assert.equal(tree.block("a")?.materialId, "steel");
    assert.equal(
      tree.accepts({ action: "material-removed", id: "glass", keepContents: true }),
      false
    );
  });

  test("counts the blocks using each material, unused ones included", () => {
    const tree = treeOf(
      materialAdded("glass"),
      materialAdded("metal"),
      { action: "node-added", node: { ...blockNode("a"), materialId: "glass" } },
      { action: "node-added", node: { ...blockNode("b"), materialId: "glass" } },
      blockAdded("c")
    );

    assert.deepEqual(
      tree.materialUses(),
      new Map([["glass", 2], ["metal", 0]])
    );
  });

  test("hands out copies", () => {
    const tree = treeOf(blockAdded("a"));

    const node = blockNode("a");
    const loaded = new ModelTree();
    loaded.load({ nodes: [node], materials: [], animationSets: [] });

    assert.notStrictEqual(tree.block("a"), tree.block("a"));
    assert.notStrictEqual(loaded.block("a"), node);
    assert.deepEqual(loaded.block("a"), node);
  });
});

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
        InvalidModelTreeError
      );
    }
  });

  test("keeps the current nodes and materials when a load is rejected", () => {
    const tree = treeOf(materialAdded("glass"), blockAdded("body"));

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

describe("ModelTree.imagesOf", () => {
  test("returns the nodes a command changes, as they are before it", () => {
    const tree = treeOf(
      folderAdded("f"),
      blockAdded("a", "f"),
      blockAdded("b")
    );

    assert.deepEqual(tree.imagesOf(blockAdded("c")).nodes, []);
    assert.deepEqual(
      tree.imagesOf({ action: "node-removed", id: "f" }).nodes.map((node) => node.id),
      ["f", "a"]
    );
    assert.deepEqual(
      tree.imagesOf({
        action: "node-moved",
        id: "a",
        parentId: null,
        transforms: [{ id: "a", transform: TRANSFORM }, { id: "b", transform: TRANSFORM }]
      }).nodes.map((node) => node.id),
      ["a", "b"]
    );
    assert.deepEqual(
      tree.imagesOf({ action: "node-renamed", id: "b", name: "B" }),
      { nodes: [blockNode("b")], materials: [], animationSets: [] }
    );
    assert.deepEqual(
      tree.imagesOf({ action: "node-renamed", id: "missing", name: "B" }).nodes,
      []
    );
  });

  test("returns the blocks a material removal clears", () => {
    const tree = treeOf(
      materialFolderAdded("metals"),
      materialAdded("iron", "metals"),
      materialAdded("glass"),
      { action: "node-added", node: { ...blockNode("a"), materialId: "iron" } },
      { action: "node-added", node: { ...blockNode("b"), materialId: "glass" } }
    );

    assert.deepEqual(
      tree.imagesOf({ action: "material-removed", id: "metals" }).nodes.map((node) => node.id),
      ["a"]
    );
    assert.deepEqual(
      tree.imagesOf({ action: "material-removed", id: "metals", keepContents: true }).nodes,
      []
    );
    assert.deepEqual(
      tree.imagesOf({ action: "material-renamed", id: "glass", name: "Glass" }).nodes,
      []
    );
  });

  test("returns the library entries a command changes, as they are before it", () => {
    const tree = treeOf(
      materialFolderAdded("metals"),
      materialAdded("iron", "metals"),
      materialAdded("glass")
    );
    function materialsOf(
      command: VoxelModelCommand
    ): unknown {
      return tree.imagesOf(command).materials;
    }

    assert.deepEqual(materialsOf(materialAdded("gold")), []);
    assert.deepEqual(materialsOf(blockAdded("a")), []);
    assert.deepEqual(
      materialsOf({ action: "material-removed", id: "metals" }),
      [materialFolder("metals"), material("iron", "metals")]
    );
    assert.deepEqual(
      materialsOf({ action: "material-removed", id: "metals", keepContents: true }),
      [materialFolder("metals"), material("iron", "metals")]
    );
    assert.deepEqual(
      materialsOf({ action: "material-changed", id: "glass", surface: { opacity: 0.5 } }),
      [material("glass")]
    );
    assert.deepEqual(
      materialsOf({ action: "material-moved", id: "missing", parentId: null }),
      []
    );
  });
});

describe("ModelTree.placeable", () => {
  test("keeps a beforeId the tree would accept and drops one it would refuse", () => {
    const tree = treeOf(
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
