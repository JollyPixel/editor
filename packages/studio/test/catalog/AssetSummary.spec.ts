// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AssetKindSet } from "../../src/catalog/AssetKindSet.ts";
import { AssetPath } from "../../src/catalog/AssetPath.ts";
import { AssetSelection } from "../../src/catalog/AssetSelection.ts";
import {
  NO_ASSET_SUMMARY,
  summarizeSelection,
  type AssetSummary
} from "../../src/catalog/AssetSummary.ts";
import {
  assetNodeId,
  folderNodeId
} from "../../src/catalog/AssetTreeModel.ts";
import { createCompanionModel } from "../helpers/assetTree.ts";

// CONSTANTS
const kModel = createCompanionModel();
const kKinds = new AssetKindSet({
  kinds: [
    {
      kind: "voxelmap",
      label: "Voxel map",
      extension: ".voxelmap.json",
      extensions: [".voxelmap.json"],
      icon: "voxel-map",
      preview: "frame"
    },
    {
      kind: "blockset",
      label: "Blockset",
      extension: ".blockset.json",
      extensions: [".blockset.json"],
      preview: "server"
    }
  ],
  editors: [
    {
      package: "@jolly-pixel/editor.voxel-map",
      kinds: ["voxelmap"]
    }
  ],
  maxContentBytes: 1024
});

function createSummary(
  ...nodeIds: string[]
): AssetSummary {
  return summarizeSelection(
    new AssetSelection(kModel, nodeIds),
    kKinds,
    (assetId) => `${assetId}@r1`
  );
}

describe("AssetSummary", () => {
  test("an editable asset names its kind, its folder and the asset to open", () => {
    assert.deepEqual(createSummary(assetNodeId("map-cave")), {
      subject: "asset",
      title: "cave.voxelmap.json",
      icon: "voxel-map",
      kindLabel: "Voxel map",
      location: "/maps",
      editableAssetId: "map-cave",
      preview: {
        assetId: "map-cave",
        revision: "map-cave@r1",
        source: "frame"
      }
    });
  });

  test("an asset without an editor offers nothing to open", () => {
    assert.partialDeepStrictEqual(createSummary(assetNodeId("blockset-overworld")), {
      kindLabel: "Blockset",
      editableAssetId: null
    });
  });

  test("an asset of a kind with previews names the asset, revision and source to preview", () => {
    assert.partialDeepStrictEqual(createSummary(assetNodeId("blockset-overworld")), {
      preview: {
        assetId: "blockset-overworld",
        revision: "blockset-overworld@r1",
        source: "server"
      }
    });
  });

  test("an asset of a kind without previews names nothing to preview", () => {
    assert.partialDeepStrictEqual(createSummary(assetNodeId("notes-hero")), {
      preview: null
    });
  });

  test("an asset of an unknown kind falls back to the raw kind", () => {
    assert.partialDeepStrictEqual(createSummary(assetNodeId("notes-hero")), {
      kindLabel: "binary",
      editableAssetId: null
    });
  });

  test("a folder is described from its parent", () => {
    assert.deepEqual(createSummary(folderNodeId(AssetPath.parse("models"))), {
      subject: "folder",
      title: "models",
      icon: "folder",
      kindLabel: "Folder",
      location: "/"
    });
  });

  test("several nodes only report how many are selected", () => {
    const summary = createSummary(
      assetNodeId("map-cave"),
      assetNodeId("model-hero")
    );

    assert.deepEqual(summary, {
      subject: "many",
      count: 2
    });
  });

  test("an empty or stale selection describes nothing", () => {
    assert.equal(createSummary(), NO_ASSET_SUMMARY);
    assert.equal(createSummary(assetNodeId("gone")), NO_ASSET_SUMMARY);
  });
});
