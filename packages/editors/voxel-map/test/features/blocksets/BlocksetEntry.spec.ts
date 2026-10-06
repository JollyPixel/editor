// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BlocksetEntry } from "../../../src/features/blocksets/BlocksetEntry.ts";

// CONSTANTS
const kRecords = [
  {
    id: "map-1",
    kind: "voxelmap",
    source: "maps/overworld.voxelmap.json"
  },
  {
    id: "asset-block",
    kind: "blockset",
    source: "blocksets/block.blockset.json"
  },
  {
    id: "asset-stone",
    kind: "blockset",
    source: "blocksets/stone.blockset.json"
  }
];

describe("BlocksetEntry equality", () => {
  const kDefinition = {
    id: "stone",
    asset: {
      id: "asset-stone",
      kind: "blockset"
    },
    tileSize: 16
  };

  it("compares definitions field by field regardless of key order", () => {
    assert.equal(BlocksetEntry.sameDefinition(kDefinition, {
      tileSize: 16,
      asset: {
        id: "asset-stone",
        kind: "blockset"
      },
      id: "stone"
    }), true);
    assert.equal(BlocksetEntry.sameDefinition(kDefinition, { ...kDefinition, tileSize: 32 }), false);
    assert.equal(BlocksetEntry.sameDefinition(kDefinition, { ...kDefinition, cols: 4 }), false);
    assert.equal(BlocksetEntry.sameDefinition(kDefinition, {
      ...kDefinition,
      asset: {
        id: "asset-granite",
        kind: "blockset"
      }
    }), false);
  });

  it("compares entries by asset, label and definition", () => {
    const entry = new BlocksetEntry(kDefinition, "asset-stone", "stone");

    assert.equal(entry.equals(new BlocksetEntry(kDefinition, "asset-stone", "stone")), true);
    assert.equal(entry.equals(new BlocksetEntry(kDefinition, "asset-stone", "granite")), false);
    assert.equal(entry.equals(new BlocksetEntry(kDefinition, null, "stone")), false);
    assert.equal(entry.id, "stone");
    assert.equal(entry.linked, true);
  });
});

describe("BlocksetEntry.resolveAll", () => {
  it("labels a linked blockset with its asset name and an unlinked one with its id", () => {
    const entries = BlocksetEntry.resolveAll([
      {
        id: "default",
        asset: {
          id: "asset-block",
          kind: "blockset"
        },
        tileSize: 32
      },
      {
        id: "external",
        src: "textures/blockset.png",
        tileSize: 16
      },
      {
        id: "unknown",
        asset: {
          id: "asset-missing",
          kind: "blockset"
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
    const [entry] = BlocksetEntry.resolveAll([
      {
        id: "map",
        asset: {
          id: "map-1",
          kind: "blockset"
        },
        tileSize: 16
      }
    ], kRecords);

    assert.equal(entry.assetId, null);
  });
});
