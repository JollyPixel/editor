// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TilesetEntry } from "../../../src/features/tilesets/TilesetEntry.ts";

// CONSTANTS
const kRecords = [
  {
    id: "map-1",
    kind: "voxelmap",
    source: "maps/overworld.voxelmap.json"
  },
  {
    id: "asset-block",
    kind: "tileset",
    source: "tilesets/block.tileset.json"
  },
  {
    id: "asset-stone",
    kind: "tileset",
    source: "tilesets/stone.tileset.json"
  }
];

describe("TilesetEntry equality", () => {
  const kDefinition = {
    id: "stone",
    asset: {
      id: "asset-stone",
      kind: "tileset"
    },
    tileSize: 16
  };

  it("compares definitions field by field regardless of key order", () => {
    assert.equal(TilesetEntry.sameDefinition(kDefinition, {
      tileSize: 16,
      asset: {
        id: "asset-stone",
        kind: "tileset"
      },
      id: "stone"
    }), true);
    assert.equal(TilesetEntry.sameDefinition(kDefinition, { ...kDefinition, tileSize: 32 }), false);
    assert.equal(TilesetEntry.sameDefinition(kDefinition, { ...kDefinition, cols: 4 }), false);
    assert.equal(TilesetEntry.sameDefinition(kDefinition, {
      ...kDefinition,
      asset: {
        id: "asset-granite",
        kind: "tileset"
      }
    }), false);
  });

  it("compares entries by asset, label and definition", () => {
    const entry = new TilesetEntry(kDefinition, "asset-stone", "stone");

    assert.equal(entry.equals(new TilesetEntry(kDefinition, "asset-stone", "stone")), true);
    assert.equal(entry.equals(new TilesetEntry(kDefinition, "asset-stone", "granite")), false);
    assert.equal(entry.equals(new TilesetEntry(kDefinition, null, "stone")), false);
    assert.equal(entry.id, "stone");
    assert.equal(entry.linked, true);
  });
});

describe("TilesetEntry.resolveAll", () => {
  it("labels a linked tileset with its asset name and an unlinked one with its id", () => {
    const entries = TilesetEntry.resolveAll([
      {
        id: "default",
        asset: {
          id: "asset-block",
          kind: "tileset"
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
          kind: "tileset"
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

  it("ignores records of another kind that share an asset id", () => {
    const [entry] = TilesetEntry.resolveAll([
      {
        id: "map",
        asset: {
          id: "map-1",
          kind: "tileset"
        },
        tileSize: 16
      }
    ], kRecords);

    assert.equal(entry.assetId, null);
  });
});
