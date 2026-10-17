// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetLeafData
} from "../../src/catalog/AssetTreeModel.ts";
import {
  COMPANION_EDGES,
  COMPANION_RECORDS,
  createCompanionModel,
  createDependencies
} from "../helpers/assetTree.ts";

// CONSTANTS
const kMaps = folderNodeId(AssetPath.parse("maps"));

function collectIds(
  assets: readonly AssetLeafData[]
): string[] {
  return assets.map((asset) => asset.id);
}

describe("AssetTreeModel deletion", () => {
  test("offers the companions of a deleted owner and who still references them", () => {
    const deletion = createCompanionModel().planDeletion([assetNodeId("map-overworld")]);

    assert.deepEqual(collectIds(deletion.assets), ["map-overworld"]);
    assert.deepEqual(collectIds(deletion.companions), ["blockset-overworld"]);
    assert.deepEqual(deletion.dependents(false), []);
    assert.deepEqual(deletion.dependents(true), ["maps/cave.voxelmap.json"]);
    assert.deepEqual(
      collectIds(deletion.removals(true)),
      ["map-overworld", "blockset-overworld"]
    );
    assert.deepEqual(collectIds(deletion.removals(false)), ["map-overworld"]);
  });

  test("offers no companion or dependent the selection already deletes", () => {
    const deletion = createCompanionModel().planDeletion([
      kMaps,
      assetNodeId("map-overworld")
    ]);

    assert.deepEqual(
      collectIds(deletion.assets),
      ["map-overworld", "blockset-overworld", "map-cave"]
    );
    assert.deepEqual(deletion.companions, []);
    assert.deepEqual(deletion.dependents(true), []);
  });

  test("deletes nothing for an empty folder, but names it", () => {
    const drafts = AssetPath.parse("maps/drafts");
    const model = new AssetTreeModel(COMPANION_RECORDS, {
      dependencies: createDependencies(COMPANION_EDGES),
      folders: [drafts]
    });
    const deletion = model.planDeletion([folderNodeId(drafts), "asset:unknown"]);

    assert.equal(deletion.isEmpty, true);
    assert.deepEqual(deletion.folders, [drafts]);
  });
});
