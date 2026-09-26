// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { TilesetList } from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentEvents } from "../../../src/document/index.ts";
import { TilesetStore } from "../../../src/state/index.ts";
import { TilesetDirectory } from "../../../src/features/tilesets/TilesetDirectory.ts";

// CONSTANTS
const kStone = {
  id: "stone",
  asset: {
    id: "asset-stone",
    kind: "tileset"
  }
};

class FakeCatalog extends Emitter<{ change: () => void; }> {
  list: AssetRecordData[] = [];

  records(): Iterable<AssetRecordData> {
    return this.list;
  }
}

function setup() {
  const store = new TilesetStore();
  const tilesets = new TilesetList();
  const mapDocument = new Emitter<MapDocumentEvents>();
  const catalog = new FakeCatalog();
  const directory = new TilesetDirectory({
    store,
    tilesets,
    mapDocument,
    catalog
  });

  return { store, tilesets, mapDocument, catalog, directory };
}

function ids(
  store: TilesetStore
): string[] {
  return store.entries.map((entry) => entry.definition.id);
}

describe("TilesetDirectory", () => {
  it("publishes the engine tilesets as soon as it is created", () => {
    const { store } = setup();

    assert.deepEqual(ids(store), []);
  });

  it("refreshes when the document reports a tileset change", () => {
    const { store, tilesets, mapDocument } = setup();

    tilesets.replace([kStone]);
    assert.deepEqual(ids(store), []);

    mapDocument.emit("tilesetsChanged");
    assert.deepEqual(ids(store), ["stone"]);
    assert.equal(store.entries[0].definition.slot, 0);
  });

  it("relabels entries when the catalog changes", () => {
    const { store, tilesets, mapDocument, catalog } = setup();
    tilesets.replace([kStone]);
    mapDocument.emit("tilesetsChanged");
    assert.equal(store.entries[0].assetId, null);

    catalog.list = [
      {
        id: "asset-stone",
        kind: "tileset",
        source: "tilesets/granite.tileset.json"
      } as AssetRecordData
    ];
    catalog.emit("change");

    assert.equal(store.entries[0].assetId, "asset-stone");
    assert.equal(store.entries[0].label, "granite");
  });

  it("stops following the document and catalog once disposed", () => {
    const { store, tilesets, mapDocument, catalog, directory } = setup();

    directory.dispose();
    tilesets.replace([kStone]);
    mapDocument.emit("tilesetsChanged");
    catalog.emit("change");

    assert.deepEqual(ids(store), []);
  });
});
