// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetSelection } from "../../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../src/catalog/AssetTreeModel.ts";
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import { createCompanionModel } from "../helpers/assetTree.ts";

// CONSTANTS
const kModel = createCompanionModel();
const kModels = folderNodeId(AssetPath.parse("models"));
const kHero = assetNodeId("model-hero");
const kCave = assetNodeId("map-cave");

describe("AssetSelection", () => {
  test("an empty selection creates at the root", () => {
    const selection = new AssetSelection(kModel, []);

    assert.equal(selection.isEmpty, true);
    assert.equal(selection.isFolder, false);
    assert.equal(selection.asset, null);
    assert.equal(selection.folder.isRoot, true);
  });

  test("a single asset creates beside it", () => {
    const selection = new AssetSelection(kModel, [kHero]);

    assert.equal(selection.asset?.id, "model-hero");
    assert.equal(selection.isFolder, false);
    assert.equal(selection.folder.toString(), "models");
  });

  test("a folder creates inside itself", () => {
    const selection = new AssetSelection(kModel, [kModels]);

    assert.equal(selection.isFolder, true);
    assert.equal(selection.asset, null);
    assert.equal(selection.folder.toString(), "models");
  });

  test("several rows name no asset and create beside the first", () => {
    const selection = new AssetSelection(kModel, [kHero, kCave]);

    assert.equal(selection.asset, null);
    assert.equal(selection.folder.toString(), "models");
  });

  test("drops the rows the model no longer holds", () => {
    const selection = new AssetSelection(kModel, ["asset:gone", kHero]);

    assert.deepEqual(selection.nodeIds, [kHero]);
    assert.equal(selection.asset?.id, "model-hero");
  });
});
