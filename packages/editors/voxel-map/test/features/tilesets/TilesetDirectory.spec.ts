// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  DEFAULT_TILE_SIZE,
  TilesetList
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TilesetStore } from "../../../src/app/state/index.ts";
import { TilesetDirectory } from "../../../src/features/tilesets/TilesetDirectory.ts";
import { setupTilesets } from "./tilesetHarness.ts";

// CONSTANTS
const kStone = {
  id: "stone",
  src: "asset-stone",
  tileSize: 32
};

function setup() {
  return setupTilesets([kStone], [
    {
      id: "asset-stone",
      kind: "pixelart",
      source: "textures/stone.pixelart"
    }
  ]);
}

describe("TilesetDirectory", () => {
  it("fills the store from the declared tilesets on construction", () => {
    const { store } = setup();

    assert.deepEqual(store.entries.map(({ definition, assetId, label }) => [
      definition.id,
      assetId,
      label
    ]), [["stone", "asset-stone", "stone"]]);
    assert.equal(store.activeTilesetId, "stone");
    assert.equal(store.defaultTileSize, DEFAULT_TILE_SIZE);
  });

  it("follows engine tileset changes", () => {
    const { engine, store } = setup();

    engine.addTileset({ id: "wood", src: "asset-wood", tileSize: 16 });
    engine.defaultTileSize = 64;

    assert.deepEqual([...store.ids()], ["stone", "wood"]);
    assert.equal(store.entry("wood")?.assetId, null);
    assert.equal(store.defaultTileSize, 64);

    engine.removeTileset("stone");
    assert.deepEqual([...store.ids()], ["wood"]);
    assert.equal(store.activeTilesetId, "wood");
  });

  it("relabels a tileset when its asset is renamed", async() => {
    const { catalog, store } = setup();

    await catalog.rename("asset-stone", "textures/granite.pixelart");

    assert.equal(store.entry("stone")?.label, "granite");
  });

  it("stops following the catalog once disposed", async() => {
    const { catalog, directory, store } = setup();

    directory.dispose();
    await catalog.rename("asset-stone", "textures/granite.pixelart");

    assert.equal(store.entry("stone")?.label, "stone");
  });

  it("works without catalog", () => {
    const store = new TilesetStore();
    new TilesetDirectory({
      store,
      tilesets: new TilesetList([kStone])
    });

    assert.deepEqual(store.entries.map(({ assetId, label }) => [assetId, label]), [
      [null, "stone"]
    ]);
  });
});
