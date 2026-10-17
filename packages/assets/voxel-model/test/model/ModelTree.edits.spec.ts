// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelTree } from "#src/model/ModelTree.ts";
import { MaterialSurface } from "#src/model/materials/MaterialSurface.ts";
import type { VoxelModelCommand } from "#src/network/types.ts";
import {
  UV,
  blockAdded,
  folderAdded,
  material,
  materialAdded,
  materialFolderAdded,
  blockNode
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
  test("rejects a UV layout for a folder or an unknown node", () => {
    const tree = createTree(folderAdded("f"));

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
    const tree = createTree(materialAdded("glass"), blockAdded("a"));

    tree.apply({ action: "node-material-changed", id: "a", materialId: "glass" });
    assert.equal(tree.block("a")?.materialId, "glass");

    tree.apply({ action: "node-material-changed", id: "a", materialId: null });
    assert.equal("materialId" in (tree.block("a") ?? {}), false);
  });

  test("rejects a material for a folder, an unknown node or an unknown material", () => {
    const tree = createTree(materialAdded("glass"), folderAdded("f"), blockAdded("a"));

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
    const tree = createTree(materialAdded("glass"));

    tree.apply({ action: "material-renamed", id: "glass", name: "Chrome" });
    tree.apply({ action: "material-changed", id: "glass", surface: { metalness: 1 } });
    tree.apply({ action: "material-changed", id: "glass", surface: { roughness: 0.2 } });

    assert.deepEqual(tree.materials.get("glass"), {
      ...material("glass"),
      name: "Chrome",
      surface: MaterialSurface.create({ metalness: 1, roughness: 0.2 })
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

  test("rejects a material or a surface change with a value off its range", () => {
    const tree = createTree(materialAdded("glass"));

    assert.equal(tree.accepts({
      action: "material-added",
      material: { ...material("iron"), surface: MaterialSurface.create({ opacity: 1.5 }) }
    }), false);
    assert.equal(
      tree.accepts({ action: "material-changed", id: "glass", surface: { color: "red" } }),
      false
    );
  });

  test("leaves the blocks of a removed material without one", () => {
    const tree = createTree(
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
    const tree = createTree(
      materialFolderAdded("metals"),
      materialAdded("glass"),
      materialAdded("steel", "metals"),
      { action: "material-added", material: material("gold", "metals"), beforeId: "steel" }
    );

    tree.apply({ action: "material-moved", id: "glass", parentId: "metals", beforeId: "gold" });

    assert.deepEqual(
      tree.materials.listChildren("metals").map(({ id }) => id),
      ["glass", "gold", "steel"]
    );
    assert.deepEqual(tree.materials.listChildren(null).map(({ id }) => id), ["metals"]);
    assert.deepEqual([...tree.materials.materials()].map(({ id }) => id), ["glass", "gold", "steel"]);
  });

  test("reads the material of a block, and none for a folder or an unknown id", () => {
    const tree = createTree(
      materialAdded("glass"),
      { action: "node-added", node: { ...blockNode("body"), materialId: "glass" } },
      blockAdded("arm"),
      folderAdded("limbs")
    );

    assert.equal(tree.blockMaterialId("body"), "glass");
    assert.equal(tree.blockMaterialId("arm"), undefined);
    assert.equal(tree.blockMaterialId("limbs"), undefined);
    assert.equal(tree.blockMaterialId("missing"), undefined);
    assert.deepEqual(tree.blocksUsing("glass"), ["body"]);
    assert.deepEqual(tree.blocksUsing("missing"), []);
  });

  test("finds the next sibling of a node or material, skipping other parents", () => {
    const tree = createTree(
      blockAdded("body"),
      folderAdded("limbs", "body"),
      blockAdded("head"),
      materialFolderAdded("metals"),
      materialAdded("steel", "metals"),
      materialAdded("glass"),
      materialAdded("gold", "metals")
    );

    assert.equal(tree.findNextSibling("body"), "head");
    assert.equal(tree.findNextSibling("head"), undefined);
    assert.equal(tree.findNextSibling("missing"), undefined);
    assert.equal(tree.materials.findNextSibling("steel"), "gold");
    assert.equal(tree.materials.findNextSibling("metals"), "glass");
  });

  test("rejects a material parent that is not a folder, a cycle and a foreign sibling", () => {
    const tree = createTree(
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
      { action: "material-changed", id: "metals", surface: MaterialSurface.create() },
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
    const tree = createTree(
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
    const tree = createTree(
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
    const tree = createTree(
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
});
