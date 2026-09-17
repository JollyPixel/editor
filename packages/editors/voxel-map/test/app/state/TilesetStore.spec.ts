// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Third-party Dependencies
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TilesetStore } from "../../../src/app/state/index.ts";
import type { TilesetEntry } from "../../../src/features/tilesets/tilesetEntries.ts";

function entry(
  id: string,
  label = id
): TilesetEntry {
  return {
    definition: {
      id,
      src: `asset-${id}`,
      tileSize: 16
    },
    assetId: `asset-${id}`,
    label
  };
}

describe("TilesetStore", () => {
  it("starts empty with the default tile size", () => {
    const store = new TilesetStore();

    assert.deepEqual(store.entries, []);
    assert.equal(store.defaultTileSize, DEFAULT_TILE_SIZE);
    assert.equal(store.activeTilesetId, null);
    assert.equal(store.firstTilesetId, null);
  });

  it("emits change only when the entries or the default differ", () => {
    const store = new TilesetStore();
    let changes = 0;
    store.watch("change", () => changes++);

    store.replace([entry("stone")]);
    store.replace([entry("stone")]);
    store.replace([entry("stone")], 64);
    store.replace([entry("stone", "granite")], 64);

    assert.equal(changes, 3);
    assert.equal(store.defaultTileSize, 64);
    assert.equal(store.entry("stone")?.label, "granite");
  });

  it("activates the first tileset until one is picked", () => {
    const store = new TilesetStore();
    const active: (string | null)[] = [];
    store.watch("activeChange", (id) => active.push(id));

    store.replace([entry("stone"), entry("wood")]);
    store.activeTilesetId = "wood";
    store.activeTilesetId = "unknown";
    store.replace([entry("stone"), entry("wood")]);

    assert.deepEqual(active, ["stone", "wood"]);
    assert.equal(store.activeTilesetId, "wood");
  });

  it("falls back when the active tileset is removed", () => {
    const store = new TilesetStore();
    store.replace([entry("stone"), entry("wood")]);
    store.activeTilesetId = "wood";

    store.replace([entry("stone")]);
    assert.equal(store.activeTilesetId, "stone");

    store.replace([]);
    assert.equal(store.activeTilesetId, null);
    assert.deepEqual([...store.ids()], []);
  });
});
