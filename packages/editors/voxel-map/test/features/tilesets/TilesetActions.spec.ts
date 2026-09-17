// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { decodePixelArtDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TilesetActions } from "../../../src/features/tilesets/TilesetActions.ts";
import { setupTilesets } from "./tilesetHarness.ts";

function setup() {
  const harness = setupTilesets(
    [
      {
        id: "stone",
        src: "asset-stone",
        tileSize: 32
      }
    ],
    [
      {
        id: "asset-stone",
        kind: "pixelart",
        source: "textures/stone.pixelart"
      },
      {
        id: "asset-free",
        kind: "pixelart",
        source: "textures/free.pixelart"
      },
      {
        id: "asset-map",
        kind: "voxelmap",
        source: "maps/world.voxelmap.json"
      }
    ]
  );
  let next = 0;
  const actions = new TilesetActions({
    engine: harness.engine,
    catalog: harness.catalog,
    store: harness.store,
    generateId: () => (next++ === 0 ? "stone" : `tileset-${next}`)
  });

  return {
    ...harness,
    actions
  };
}

describe("TilesetActions", () => {
  it("lists the pixel-art assets the map does not use yet", () => {
    const { actions } = setup();

    assert.deepEqual(actions.linkableAssets().map(({ id }) => id), ["asset-free"]);
  });

  it("links an existing asset under a fresh tileset id", () => {
    const { actions, store, events } = setup();

    const tilesetId = actions.link({
      assetId: "asset-free",
      tileSize: 16
    });

    assert.equal(tilesetId, "tileset-2");
    assert.deepEqual(store.entry("tileset-2")?.definition, {
      id: "tileset-2",
      src: "asset-free",
      tileSize: 16
    });
    assert.deepEqual(events.map(({ action }) => action), ["tileset-added"]);
  });

  it("returns null when the map refuses the tileset", () => {
    const { actions } = setup();

    assert.equal(actions.link({ assetId: "asset-free", tileSize: 0 }), null);
  });

  it("creates a blank pixel-art asset and lets the server pick a free path", async() => {
    const { actions, catalog, store } = setup();

    const tilesetId = await actions.create({
      name: " grass ",
      tileSize: 16,
      cols: 4,
      rows: 2
    });

    const [created] = catalog.created;
    assert.equal(created.path, "textures/grass.pixelart");
    assert.deepEqual(created.options, {
      kind: "pixelart",
      onConflict: "suffix"
    });
    assert.deepEqual(decodePixelArtDocument(created.content).size, { x: 64, y: 32 });
    assert.notEqual(tilesetId, null);
    assert.equal(store.entry(tilesetId!)?.label, "grass");
  });

  it("propagates a catalog error", async() => {
    const { actions, catalog } = setup();
    catalog.create = () => Promise.reject(new Error("forbidden"));

    await assert.rejects(
      actions.create({
        name: "grass",
        tileSize: 16,
        cols: 1,
        rows: 1
      }),
      /forbidden/
    );
  });

  it("renames the asset behind a tileset", async() => {
    const { actions, catalog } = setup();

    await actions.rename("stone", "granite");
    await actions.rename("stone", "  ");
    await actions.rename("missing", "other");

    assert.deepEqual(catalog.renamed, [
      ["asset-stone", "textures/granite.pixelart"]
    ]);
  });

  it("removes, resizes and updates the default tile size through the engine", () => {
    const { actions, store } = setup();

    assert.equal(actions.resize("stone", 16), true);
    assert.equal(store.entry("stone")?.definition.tileSize, 16);
    actions.updateDefaultTileSize(8);
    assert.equal(store.defaultTileSize, 8);
    assert.equal(actions.remove("stone"), true);
    assert.equal(store.entries.length, 0);
  });
});
