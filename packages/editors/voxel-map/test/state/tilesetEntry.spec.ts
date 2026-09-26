// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  definitionsEqual,
  entriesEqual
} from "../../src/state/tilesetEntry.ts";

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
