// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../../src/catalog/AssetPath.ts";
import { AssetSelection } from "../../../src/catalog/AssetSelection.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../../src/catalog/AssetTreeModel.ts";
import {
  AssetActions,
  type AssetAction
} from "../../../src/shell/assets/AssetActions.ts";
import { createCompanionModel } from "../../helpers/assetTree.ts";

// CONSTANTS
const kModel = createCompanionModel();
const kModels = folderNodeId(AssetPath.parse("models"));
const kHero = assetNodeId("model-hero");
const kCave = assetNodeId("map-cave");
const kEvery: readonly AssetAction[] = [
  "open",
  "new-folder",
  "rename",
  "delete",
  "replace",
  "export",
  "share"
];
const kSharing = new AssetActions({ sharing: true });

function allowed(
  nodeIds: readonly string[],
  actions = kSharing
): AssetAction[] {
  const selection = new AssetSelection(kModel, nodeIds);

  return kEvery.filter((action) => actions.allows(action, selection));
}

describe("AssetActions", () => {
  test("an empty selection only creates a folder", () => {
    assert.deepEqual(allowed([]), ["new-folder"]);
  });

  test("a single asset allows every action", () => {
    assert.deepEqual(allowed([kHero]), kEvery);
  });

  test("a folder is renamed or deleted but neither opened nor exported", () => {
    assert.deepEqual(allowed([kModels]), ["new-folder", "rename", "delete"]);
  });

  test("several rows are only deleted together", () => {
    assert.deepEqual(allowed([kHero, kCave]), ["new-folder", "delete"]);
  });

  test("share is neither offered nor allowed when the studio cannot share", () => {
    const actions = new AssetActions({ sharing: false });

    assert.equal(actions.offers("share"), false);
    assert.equal(actions.offers("export"), true);
    assert.equal(actions.offers("duplicate"), false);
    assert.deepEqual(allowed([kHero], actions), kEvery.filter(
      (action) => action !== "share"
    ));
    assert.deepEqual(
      actions.buttons().map((button) => button.id),
      ["new-folder", "rename", "delete", "replace", "export"]
    );
  });
});
