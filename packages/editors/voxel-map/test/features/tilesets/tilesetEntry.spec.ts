// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  definitionsEqual,
  entriesEqual,
  resolveTilesetEntries
} from "../../../src/features/tilesets/tilesetEntry.ts";

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

describe("definitionsEqual and entriesEqual", () => {
  const kDefinition = {
    id: "stone",
    asset: {
      id: "asset-stone",
      kind: "tileset"
    },
    tileSize: 16
  };

  it("compares definitions field by field regardless of key order", () => {
    assert.equal(definitionsEqual(kDefinition, {
      tileSize: 16,
      asset: {
        id: "asset-stone",
        kind: "tileset"
      },
      id: "stone"
    }), true);
    assert.equal(definitionsEqual(kDefinition, { ...kDefinition, tileSize: 32 }), false);
    assert.equal(definitionsEqual(kDefinition, { ...kDefinition, cols: 4 }), false);
    assert.equal(definitionsEqual(kDefinition, {
      ...kDefinition,
      asset: {
        id: "asset-granite",
        kind: "tileset"
      }
    }), false);
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

describe("resolveTilesetEntries", () => {
  it("labels a linked tileset with its asset name and an unlinked one with its id", () => {
    const entries = resolveTilesetEntries([
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
    const [entry] = resolveTilesetEntries([
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
