// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  resolveTilesetAsset,
  resolveTilesetEntries
} from "../../../src/features/tilesets/tilesetEntries.ts";

// CONSTANTS
const kRecords = [
  {
    id: "map-1",
    kind: "voxelmap",
    source: "maps/overworld.voxelmap.json"
  },
  {
    id: "asset-block",
    kind: "pixelart",
    source: "textures/block.pixelart"
  },
  {
    id: "asset-stone",
    kind: "pixelart",
    source: "textures/stone.pixelart"
  }
];

describe("resolveTilesetAsset", () => {
  it("finds a pixel-art record by asset id", () => {
    assert.equal(resolveTilesetAsset("asset-stone", kRecords)?.id, "asset-stone");
  });

  it("ignores records of another kind and unknown ids", () => {
    assert.equal(resolveTilesetAsset("map-1", kRecords), null);
    assert.equal(resolveTilesetAsset("textures/block.pixelart", kRecords), null);
  });
});

describe("resolveTilesetEntries", () => {
  it("labels a linked tileset with its asset name and an unlinked one with its id", () => {
    const entries = resolveTilesetEntries([
      {
        id: "default",
        asset: {
          id: "asset-block",
          kind: "pixelart"
        },
        tileSize: 32
      },
      {
        id: "external",
        src: "textures/tileset.png",
        tileSize: 16
      },
      {
        id: "unknown",
        asset: {
          id: "asset-missing",
          kind: "pixelart"
        },
        tileSize: 16
      }
    ], kRecords);

    assert.deepEqual(
      entries.map(({ assetId, label }) => [assetId, label]),
      [
        ["asset-block", "block"],
        [null, "external"],
        [null, "unknown"]
      ]
    );
  });
});
