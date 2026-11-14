// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId
} from "../../src/catalog/AssetTreeModel.ts";
import {
  TREE_RECORDS,
  shape
} from "../helpers/assetTree.ts";

// CONSTANTS
const kModel = new AssetTreeModel(TREE_RECORDS);
const kMaps = folderNodeId(AssetPath.parse("maps"));
const kTextures = folderNodeId(AssetPath.parse("textures"));
const kBlocks = folderNodeId(AssetPath.parse("textures/blocks"));

describe("AssetTreeModel kind filter", () => {
  test("shows only the assets of the kind and the folders on their paths", () => {
    const model = new AssetTreeModel(TREE_RECORDS, { kind: "pixelart" });

    assert.deepEqual(shape(model.nodes), [
      ["textures", [["blocks", ["stone.pixelart"]], "A.pixelart", "b.pixelart"]]
    ]);
    assert.equal(model.has(kMaps), false);
    assert.equal(model.has(assetNodeId("readme")), false);
  });

  test("hides nested folders holding only other kinds, at any depth", () => {
    const model = new AssetTreeModel([
      ...TREE_RECORDS,
      {
        id: "map-in-textures",
        kind: "voxelmap",
        path: "textures/level.voxelmap.json"
      },
      {
        id: "map-deep",
        kind: "voxelmap",
        path: "worlds/north/caves/deep.voxelmap.json"
      },
      {
        id: "tex-in-worlds",
        kind: "pixelart",
        path: "worlds/south/sand.pixelart"
      }
    ], { kind: "voxelmap" });

    assert.deepEqual(shape(model.nodes), [
      ["maps", ["cave.voxelmap.json", "overworld.voxelmap.json"]],
      ["textures", ["level.voxelmap.json"]],
      ["worlds", [["north", [["caves", ["deep.voxelmap.json"]]]]]]
    ]);
    assert.equal(model.has(kBlocks), false);
  });

  test("shows every asset for a null kind", () => {
    const model = new AssetTreeModel(TREE_RECORDS, { kind: null });

    assert.deepEqual(shape(model.nodes), shape(kModel.nodes));
  });

  test("still relocates and deletes hidden assets under a visible folder", () => {
    const model = new AssetTreeModel([
      ...TREE_RECORDS,
      {
        id: "map-in-textures",
        kind: "voxelmap",
        path: "textures/level.voxelmap.json"
      }
    ], { kind: "pixelart" });

    assert.equal(model.has(assetNodeId("map-in-textures")), false);
    assert.ok(
      model.planDeletion([kTextures]).assets.some(
        (asset) => asset.id === "map-in-textures"
      )
    );
    assert.ok(
      model.planRename(kTextures, "images")?.renames.some(
        (rename) => rename.to === "images/level.voxelmap.json"
      )
    );
  });
});
