// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import {
  ASSET_ACTIONS,
  AssetSelection,
  isAssetAction,
  type AssetAction
} from "../../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../src/catalog/AssetTreeModel.ts";
import { companionModelOf } from "../helpers/assetTree.ts";

// CONSTANTS
const kModel = companionModelOf();
const kModels = folderNodeId(AssetPath.parse("models"));
const kHero = assetNodeId("model-hero");
const kCave = assetNodeId("map-cave");

function allowed(
  selection: AssetSelection
): AssetAction[] {
  return ASSET_ACTIONS.filter((action) => selection.allows(action));
}

describe("AssetSelection", () => {
  test("an empty selection only creates a folder at the root", () => {
    const selection = new AssetSelection(kModel, []);

    assert.equal(selection.isEmpty, true);
    assert.equal(selection.asset, null);
    assert.equal(selection.folder.isRoot, true);
    assert.deepEqual(allowed(selection), ["new-folder"]);
  });

  test("a single asset allows every action and creates beside it", () => {
    const selection = new AssetSelection(kModel, [kHero]);

    assert.equal(selection.asset?.id, "model-hero");
    assert.equal(selection.folder.toString(), "models");
    assert.deepEqual(allowed(selection), [...ASSET_ACTIONS]);
  });

  test("a folder is renamed or deleted but neither opened nor exported", () => {
    const selection = new AssetSelection(kModel, [kModels]);

    assert.equal(selection.asset, null);
    assert.equal(selection.folder.toString(), "models");
    assert.deepEqual(allowed(selection), ["new-folder", "rename", "delete"]);
  });

  test("several rows are only deleted together", () => {
    const selection = new AssetSelection(kModel, [kHero, kCave]);

    assert.equal(selection.asset, null);
    assert.equal(selection.folder.toString(), "models");
    assert.deepEqual(allowed(selection), ["new-folder", "delete"]);
  });

  test("drops the rows the model no longer holds", () => {
    const selection = new AssetSelection(kModel, ["asset:gone", kHero]);

    assert.deepEqual(selection.nodeIds, [kHero]);
    assert.equal(selection.asset?.id, "model-hero");
  });

  test("isAssetAction narrows a menu item id", () => {
    assert.equal(isAssetAction("export"), true);
    assert.equal(isAssetAction("duplicate"), false);
  });
});
