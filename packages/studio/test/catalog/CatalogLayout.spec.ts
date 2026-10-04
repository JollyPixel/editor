// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CatalogLayout,
  type LaidOutRecord
} from "../../src/catalog/CatalogLayout.ts";

// CONSTANTS
const kCave = {
  id: "map-cave",
  kind: "voxelmap",
  source: "maps/cave.voxelmap.json",
  revision: "a1"
};
const kHero = {
  id: "model-hero",
  kind: "voxelmodel",
  source: "models/hero.voxelmodel.json",
  revision: "b1"
};
const kLayout = new CatalogLayout([kCave, kHero], ["maps", "models"]);

function withChange(
  change: Partial<LaidOutRecord>
): LaidOutRecord[] {
  return [
    {
      ...kCave,
      ...change
    },
    kHero
  ];
}

describe("CatalogLayout", () => {
  test("matches the same records and folders in any order", () => {
    assert.ok(kLayout.matches([kHero, kCave], ["models", "maps"]));
  });

  test("ignores a revision change", () => {
    assert.ok(kLayout.matches(
      [
        {
          ...kCave,
          revision: "a2"
        },
        kHero
      ],
      ["maps", "models"]
    ));
  });

  test("detects a moved or retyped record", () => {
    assert.ok(!kLayout.matches(
      withChange({ source: "maps/den.voxelmap.json" }),
      ["maps", "models"]
    ));
    assert.ok(!kLayout.matches(
      withChange({ kind: "zone" }),
      ["maps", "models"]
    ));
  });

  test("detects an added or removed record", () => {
    assert.ok(!kLayout.matches([kCave], ["maps", "models"]));
    assert.ok(!kLayout.matches(
      [
        kCave,
        kHero,
        {
          id: "map-den",
          kind: "voxelmap",
          source: "maps/den.voxelmap.json"
        }
      ],
      ["maps", "models"]
    ));
  });

  test("detects an added or removed folder", () => {
    assert.ok(!kLayout.matches([kCave, kHero], ["maps"]));
    assert.ok(!kLayout.matches([kCave, kHero], ["maps", "models", "props"]));
  });
});
