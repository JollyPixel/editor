// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetPath } from "../src/catalog/AssetPath.ts";
import {
  AssetTreeModel,
  assetNodeId,
  folderNodeId,
  type AssetLeafData
} from "../src/catalog/AssetTreeModel.ts";
import {
  COMPANION_EDGES,
  COMPANION_RECORDS,
  companionModelOf,
  dependenciesOf
} from "./helpers/assetTree.ts";

// CONSTANTS
const kMaps = folderNodeId(AssetPath.parse("maps"));

function idsOf(
  assets: readonly AssetLeafData[]
): string[] {
  return assets.map((asset) => asset.id);
}

describe("AssetTreeModel deletion", () => {
  test("offers the companions of a deleted owner and who still references them", () => {
    const deletion = companionModelOf().deletionOf([assetNodeId("map-overworld")]);

    assert.deepEqual(idsOf(deletion.assets), ["map-overworld"]);
    assert.deepEqual(idsOf(deletion.companions), ["tileset-overworld"]);
    assert.deepEqual(deletion.dependents(false), []);
    assert.deepEqual(deletion.dependents(true), ["maps/cave.voxelmap.json"]);
    assert.deepEqual(
      idsOf(deletion.removals(true)),
      ["map-overworld", "tileset-overworld"]
    );
    assert.deepEqual(idsOf(deletion.removals(false)), ["map-overworld"]);
  });

  test("offers no companion or dependent the selection already deletes", () => {
    const deletion = companionModelOf().deletionOf([
      kMaps,
      assetNodeId("map-overworld")
    ]);

    assert.deepEqual(
      idsOf(deletion.assets),
      ["map-overworld", "tileset-overworld", "map-cave"]
    );
    assert.deepEqual(deletion.companions, []);
    assert.deepEqual(deletion.dependents(true), []);
  });

  test("deletes nothing for an empty folder, but names it", () => {
    const drafts = AssetPath.parse("maps/drafts");
    const model = new AssetTreeModel(COMPANION_RECORDS, {
      dependencies: dependenciesOf(COMPANION_EDGES),
      folders: [drafts]
    });
    const deletion = model.deletionOf([folderNodeId(drafts), "asset:unknown"]);

    assert.equal(deletion.isEmpty, true);
    assert.deepEqual(deletion.folders, [drafts]);
  });
});
