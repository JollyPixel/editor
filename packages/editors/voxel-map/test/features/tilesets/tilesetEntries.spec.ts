// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  definitionsEqual,
  entriesEqual,
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

  it("falls back to a pixel-art record whose source matches", () => {
    assert.equal(
      resolveTilesetAsset("textures/block.pixelart", kRecords)?.id,
      "asset-block"
    );
  });

  it("prefers an id match over an earlier source match", () => {
    const records = [
      {
        id: "a",
        kind: "pixelart",
        source: "b"
      },
      {
        id: "b",
        kind: "pixelart",
        source: "textures/b.pixelart"
      }
    ];

    assert.equal(resolveTilesetAsset("b", records)?.id, "b");
  });

  it("ignores records of another kind and unknown sources", () => {
    assert.equal(resolveTilesetAsset("map-1", kRecords), null);
    assert.equal(resolveTilesetAsset("textures/tileset.png", kRecords), null);
  });
});

describe("resolveTilesetEntries", () => {
  it("labels a linked tileset with its asset name and an unlinked one with its id", () => {
    const entries = resolveTilesetEntries([
      {
        id: "default",
        src: "asset-block",
        tileSize: 32
      },
      {
        id: "legacy",
        src: "textures/tileset.png",
        tileSize: 16
      }
    ], kRecords);

    assert.deepEqual(
      entries.map(({ assetId, label }) => [assetId, label]),
      [
        ["asset-block", "block"],
        [null, "legacy"]
      ]
    );
  });
});

describe("definitionsEqual and entriesEqual", () => {
  const kDefinition = {
    id: "stone",
    src: "asset-stone",
    tileSize: 16
  };

  it("compares definitions field by field regardless of key order", () => {
    assert.equal(definitionsEqual(kDefinition, {
      tileSize: 16,
      src: "asset-stone",
      id: "stone"
    }), true);
    assert.equal(definitionsEqual(kDefinition, { ...kDefinition, tileSize: 32 }), false);
    assert.equal(definitionsEqual(kDefinition, { ...kDefinition, cols: 4 }), false);
  });

  it("compares entries in order", () => {
    const entry = {
      definition: kDefinition,
      assetId: "asset-stone",
      label: "stone"
    };

    assert.equal(entriesEqual([entry], [{ ...entry }]), true);
    assert.equal(entriesEqual([entry], [{ ...entry, label: "granite" }]), false);
    assert.equal(entriesEqual([entry], []), false);
  });
});
