// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TilesetManager } from "../../src/tileset/index.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../helpers/atlas.ts";

function countingTexture(
  width = 64,
  height = 64
) {
  const texture = mockTexture(width, height);
  const counter = {
    texture,
    disposed: 0
  };
  texture.dispose = () => {
    counter.disposed++;
  };

  return counter;
}

describe("TilesetManager.registerTexture", () => {
  it("throws for an undeclared tileset without declaring it", () => {
    const manager = new TilesetManager();

    assert.throws(
      () => manager.registerTexture("terrain", mockTexture()),
      /tileset "terrain" is not declared/
    );
    assert.equal(manager.tilesets.size, 0);
  });

  it("builds the atlas from the declared definition", () => {
    const manager = new TilesetManager();
    manager.tilesets.add(makeAtlasDef({ id: "auto", cols: undefined, rows: undefined }));
    const atlas = manager.registerTexture("auto", mockTexture(64, 32));

    assert.equal(manager.atlas("auto"), atlas);
    assert.equal(atlas.def.cols, 4);
    assert.equal(atlas.def.rows, 2);
  });

  it("bumps the version so cached UV regions are invalidated", () => {
    const manager = new TilesetManager();
    manager.tilesets.add(makeAtlasDef());
    const before = manager.version;
    manager.registerTexture("atlas", mockTexture());

    assert.ok(manager.version > before);
  });

  it("disposes the texture it replaces", () => {
    const manager = new TilesetManager();
    const first = countingTexture();
    registerAtlas(manager, makeAtlasDef(), first.texture);
    manager.registerTexture("atlas", first.texture);
    assert.equal(first.disposed, 0);

    manager.registerTexture("atlas", mockTexture());
    assert.equal(first.disposed, 1);
  });
});

describe("TilesetManager.get", () => {
  it("is undefined while nothing is registered", () => {
    const manager = new TilesetManager();

    assert.equal(manager.get(), undefined);
    assert.equal(manager.get("atlas"), undefined);
  });

  it("falls back to the default tileset when no ID is given", () => {
    const manager = new TilesetManager();
    const atlas = registerAtlas(manager);
    registerAtlas(manager, makeAtlasDef({ id: "extras" }));

    assert.equal(manager.defaultTilesetId, "atlas");
    assert.equal(manager.get(), atlas);
    assert.equal(manager.get(undefined), atlas);
    assert.equal(manager.get("unknown"), undefined);
  });

  it("is undefined for a declared tileset without texture", () => {
    const manager = new TilesetManager();
    manager.tilesets.add(makeAtlasDef({ id: "later" }));

    assert.equal(manager.defaultTilesetId, "later");
    assert.equal(manager.get("later"), undefined);
  });
});

describe("TilesetManager.atlas", () => {
  it("throws when no tilesets are declared", () => {
    const manager = new TilesetManager();

    assert.throws(() => manager.atlas(), /no tilesets have been loaded/);
  });

  it("throws for a tileset without texture", () => {
    const manager = new TilesetManager();
    registerAtlas(manager);

    assert.throws(
      () => manager.atlas("unknown"),
      /tileset "unknown" is not loaded/
    );
  });

  it("returns the atlas of the requested tileset", () => {
    const manager = new TilesetManager();
    registerAtlas(manager);
    const walls = mockTexture(32, 32);
    registerAtlas(manager, makeAtlasDef({ id: "walls", cols: 2, rows: 2 }), walls);

    assert.equal(manager.atlas("walls").texture, walls);
    assert.equal(manager.atlas("walls").uvFor(0, 0).scaleU, 15 / 32);
  });
});

describe("TilesetManager.syncAtlases", () => {
  it("drops and disposes the atlas of an undeclared tileset", () => {
    const manager = new TilesetManager();
    const a = countingTexture();
    registerAtlas(manager, makeAtlasDef({ id: "a" }), a.texture);
    registerAtlas(manager, makeAtlasDef({ id: "b" }));
    manager.tilesets.remove("a");

    assert.deepEqual(manager.syncAtlases(), ["a"]);
    assert.equal(manager.get("a"), undefined);
    assert.equal(manager.defaultTilesetId, "b");
    assert.equal(a.disposed, 1);
  });

  it("rebuilds a resized atlas on the same texture", () => {
    const manager = new TilesetManager();
    const a = countingTexture();
    registerAtlas(manager, makeAtlasDef({ id: "a", cols: undefined, rows: undefined }), a.texture);
    manager.tilesets.resize("a", 32);

    assert.deepEqual(manager.syncAtlases(), ["a"]);
    const atlas = manager.atlas("a");
    assert.equal(atlas.def.tileSize, 32);
    assert.equal(atlas.def.cols, 2);
    assert.equal(atlas.texture, a.texture);
    assert.equal(a.disposed, 0);
  });

  it("returns nothing when atlases match the declarations", () => {
    const manager = new TilesetManager();
    registerAtlas(manager);
    const before = manager.version;

    assert.deepEqual(manager.syncAtlases(), []);
    assert.equal(manager.version, before);
  });
});

describe("TilesetManager.dispose", () => {
  it("disposes every texture and clears the declarations", () => {
    const manager = new TilesetManager();
    const texture = countingTexture();
    registerAtlas(manager, makeAtlasDef(), texture.texture);
    manager.dispose();

    assert.equal(texture.disposed, 1);
    assert.equal(manager.defaultTilesetId, null);
    assert.equal(manager.tilesets.size, 0);
    assert.equal(manager.get("atlas"), undefined);
  });
});
