// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_TILE_SIZE,
  TilesetList
} from "../../src/tileset/index.ts";

describe("TilesetList", () => {
  it("keeps declaration order and the first id as default", () => {
    const list = new TilesetList([
      { id: "b", src: "b", tileSize: 16 },
      { id: "a", src: "a", tileSize: 32 },
      { id: "b", src: "dup", tileSize: 8 }
    ]);

    assert.deepEqual([...list].map((def) => def.src), ["b", "a"]);
    assert.equal(list.defaultTilesetId, "b");
  });

  it("returns copies of its definitions", () => {
    const list = new TilesetList([{ id: "a", src: "a", tileSize: 16 }]);
    const [definition] = list.definitions();
    definition.tileSize = 99;

    assert.equal(list.get("a")?.tileSize, 16);
  });

  it("rejects duplicates, empty ids and invalid tile sizes", () => {
    const list = new TilesetList();

    assert.equal(list.add({ id: "", src: "x", tileSize: 16 }), false);
    assert.equal(list.add({ id: "a", src: "x", tileSize: 0 }), false);
    assert.equal(list.add({ id: "a", src: "x", tileSize: 16 }), true);
    assert.equal(list.add({ id: "a", src: "y", tileSize: 16 }), false);
    assert.equal(list.size, 1);
  });

  it("resizes and drops the stored grid", () => {
    const list = new TilesetList([{ id: "a", src: "a", tileSize: 16, cols: 4, rows: 4 }]);

    assert.equal(list.resize("a", 16), false);
    assert.equal(list.resize("missing", 32), false);
    assert.equal(list.resize("a", 32), true);
    assert.deepEqual(list.get("a"), { id: "a", src: "a", tileSize: 32 });
  });

  it("falls back to DEFAULT_TILE_SIZE for the preferred tile size", () => {
    const list = new TilesetList();
    assert.equal(list.defaultTileSize, undefined);
    assert.equal(list.preferredTileSize, DEFAULT_TILE_SIZE);

    assert.equal(list.updateDefaultTileSize(64), true);
    assert.equal(list.updateDefaultTileSize(64), false);
    assert.equal(list.preferredTileSize, 64);
  });

  it("bumps its version on every change", () => {
    const list = new TilesetList();
    const before = list.version;
    list.add({ id: "a", src: "a", tileSize: 16 });
    list.remove("a");

    assert.equal(list.version, before + 2);
    assert.equal(list.remove("a"), false);
    assert.equal(list.version, before + 2);
  });
});
