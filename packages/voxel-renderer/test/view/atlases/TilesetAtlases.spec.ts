// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AtlasAverages,
  createMissingTilesetAtlas,
  TilesetAtlases
} from "../../../src/view/atlases/index.ts";
import { MISSING_TILESET_ID } from "../../../src/document/tilesets/index.ts";
import {
  mockTexture,
  readableTexture
} from "../../helpers/mockTexture.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../../helpers/atlas.ts";

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

describe("TilesetAtlases.registerTexture", () => {
  it("throws for an undeclared tileset without declaring it", () => {
    const manager = new TilesetAtlases();

    assert.throws(
      () => manager.registerTexture("terrain", mockTexture()),
      /tileset "terrain" is not declared/
    );
    assert.equal(manager.tilesets.size, 0);
  });

  it("builds the atlas from the declared definition", () => {
    const manager = new TilesetAtlases();
    manager.tilesets.add(makeAtlasDef({ id: "auto", cols: undefined, rows: undefined }));
    const atlas = manager.registerTexture("auto", mockTexture(64, 32));

    assert.equal(manager.atlas("auto"), atlas);
    assert.equal(atlas.def.cols, 4);
    assert.equal(atlas.def.rows, 2);
  });

  it("bumps the version so cached UV regions are invalidated", () => {
    const manager = new TilesetAtlases();
    manager.tilesets.add(makeAtlasDef());
    const before = manager.version;
    manager.registerTexture("atlas", mockTexture());

    assert.ok(manager.version > before);
  });

  it("disposes the texture it replaces", () => {
    const manager = new TilesetAtlases();
    const first = countingTexture();
    registerAtlas(manager, makeAtlasDef(), first.texture);
    manager.registerTexture("atlas", first.texture);
    assert.equal(first.disposed, 0);

    manager.registerTexture("atlas", mockTexture());
    assert.equal(first.disposed, 1);
  });

  it("keeps the normal texture it is handed again and disposes a replaced one", () => {
    const manager = new TilesetAtlases();
    const texture = mockTexture();
    const normal = countingTexture();
    registerAtlas(manager, makeAtlasDef(), texture);

    manager.registerTexture("atlas", texture, normal.texture);
    manager.registerTexture("atlas", texture, normal.texture);
    assert.equal(normal.disposed, 0);
    assert.equal(manager.atlas("atlas").normal, normal.texture);

    manager.registerTexture("atlas", texture);
    assert.equal(normal.disposed, 1);
    assert.equal(manager.atlas("atlas").normal, null);
  });
});

describe("TilesetAtlases.get", () => {
  it("is undefined while nothing is registered", () => {
    const manager = new TilesetAtlases();

    assert.equal(manager.get(), undefined);
    assert.equal(manager.get("atlas"), undefined);
  });

  it("falls back to the default tileset when no ID is given", () => {
    const manager = new TilesetAtlases();
    const atlas = registerAtlas(manager);
    registerAtlas(manager, makeAtlasDef({ id: "extras" }));

    assert.equal(manager.defaultTilesetId, "atlas");
    assert.equal(manager.get(), atlas);
    assert.equal(manager.get(undefined), atlas);
    assert.equal(manager.get("unknown"), undefined);
  });

  it("is undefined for a declared tileset without texture", () => {
    const manager = new TilesetAtlases();
    manager.tilesets.add(makeAtlasDef({ id: "later" }));

    assert.equal(manager.defaultTilesetId, "later");
    assert.equal(manager.get("later"), undefined);
  });
});

describe("TilesetAtlases.atlas", () => {
  it("throws when no tilesets are declared", () => {
    const manager = new TilesetAtlases();

    assert.throws(() => manager.atlas(), /no tilesets have been loaded/);
  });

  it("throws for a tileset without texture", () => {
    const manager = new TilesetAtlases();
    registerAtlas(manager);

    assert.throws(
      () => manager.atlas("unknown"),
      /tileset "unknown" is not loaded/
    );
  });

  it("returns the atlas of the requested tileset", () => {
    const manager = new TilesetAtlases();
    registerAtlas(manager);
    const walls = mockTexture(32, 32);
    registerAtlas(manager, makeAtlasDef({ id: "walls", cols: 2, rows: 2 }), walls);

    assert.equal(manager.atlas("walls").texture, walls);
    assert.equal(manager.atlas("walls").uvFor(0, 0).scaleU, 15 / 32);
  });
});

describe("TilesetAtlases.resolve", () => {
  it("returns the atlas of a declared tileset", () => {
    const manager = new TilesetAtlases();
    const atlas = registerAtlas(manager);

    assert.equal(manager.resolve("atlas"), atlas);
    assert.equal(manager.resolve(), atlas);
  });

  it("returns undefined while a declared tileset has no texture", () => {
    const manager = new TilesetAtlases();
    manager.tilesets.add(makeAtlasDef({ id: "later" }));

    assert.equal(manager.resolve("later"), undefined);
  });

  it("falls back to one shared missing atlas without bumping the version", () => {
    const manager = new TilesetAtlases();
    const before = manager.version;

    const missing = manager.resolve("gone");

    assert.equal(missing?.def.id, MISSING_TILESET_ID);
    assert.deepEqual(
      [missing?.def.cols, missing?.def.rows],
      [1, 1]
    );
    assert.equal(manager.resolve(), missing);
    assert.equal(manager.resolve(MISSING_TILESET_ID), missing);
    assert.equal(manager.version, before);
  });

  it("paints the missing texture red with a white cross", () => {
    const { texture } = createMissingTilesetAtlas();
    const { data, width } = texture.image;
    const pixels = Array.from(data!);

    assert.deepEqual(pixels.slice(0, 4), [255, 255, 255, 255]);
    assert.deepEqual(
      pixels.slice((width - 1) * 4, width * 4),
      [255, 255, 255, 255]
    );
    assert.deepEqual(
      pixels.slice((width / 2) * 4, ((width / 2) + 1) * 4),
      [255, 23, 68, 255]
    );
  });
});

describe("TilesetAtlases.syncAtlases", () => {
  it("drops and disposes the atlas of an undeclared tileset", () => {
    const manager = new TilesetAtlases();
    const a = countingTexture();
    registerAtlas(manager, makeAtlasDef({ id: "a" }), a.texture);
    registerAtlas(manager, makeAtlasDef({ id: "b" }));
    manager.tilesets.remove("a");

    assert.deepEqual(manager.syncAtlases(), ["a"]);
    assert.equal(manager.get("a"), undefined);
    assert.equal(manager.defaultTilesetId, "b");
    assert.equal(a.disposed, 1);
  });

  it("rebuilds the atlas of a tileset declared with another tile size", () => {
    const manager = new TilesetAtlases();
    const a = countingTexture();
    registerAtlas(manager, makeAtlasDef({ id: "a", cols: undefined, rows: undefined }), a.texture);
    manager.tilesets.declare(
      makeAtlasDef({ id: "a", cols: undefined, rows: undefined, tileSize: 32 })
    );

    assert.deepEqual(manager.syncAtlases(), ["a"]);
    const atlas = manager.atlas("a");
    assert.equal(atlas.def.tileSize, 32);
    assert.equal(atlas.def.cols, 2);
    assert.equal(atlas.texture, a.texture);
    assert.equal(a.disposed, 0);
  });

  it("keeps the normal texture of a rebuilt atlas", () => {
    const manager = new TilesetAtlases();
    const normal = mockTexture();
    manager.tilesets.add(makeAtlasDef());
    manager.registerTexture("atlas", mockTexture(), normal);
    manager.tilesets.declare(makeAtlasDef({ tileSize: 32 }));

    assert.deepEqual(manager.syncAtlases(), ["atlas"]);
    assert.equal(manager.atlas("atlas").normal, normal);
  });

  it("disposes the normal texture of a dropped atlas", () => {
    const manager = new TilesetAtlases();
    const normal = countingTexture();
    manager.tilesets.add(makeAtlasDef());
    manager.registerTexture("atlas", mockTexture(), normal.texture);
    manager.tilesets.remove("atlas");

    manager.syncAtlases();

    assert.equal(normal.disposed, 1);
  });

  it("returns nothing when atlases match the declarations", () => {
    const manager = new TilesetAtlases();
    registerAtlas(manager);
    const before = manager.version;

    assert.deepEqual(manager.syncAtlases(), []);
    assert.equal(manager.version, before);
  });
});

describe("TilesetAtlases.dispose", () => {
  it("disposes every texture and keeps the declarations it does not own", () => {
    const manager = new TilesetAtlases();
    const texture = countingTexture();
    const normal = countingTexture();
    manager.tilesets.add(makeAtlasDef());
    manager.registerTexture("atlas", texture.texture, normal.texture);
    manager.dispose();

    assert.equal(texture.disposed, 1);
    assert.equal(normal.disposed, 1);
    assert.equal(manager.get("atlas"), undefined);
    assert.ok(manager.tilesets.has("atlas"));
  });
});

describe("TilesetAtlases.refreshAverages", () => {
  it("rebuilds the tables of updated atlas textures", () => {
    const manager = new TilesetAtlases();
    const data = new Uint8Array(4);
    const texture = readableTexture(1, 1, data);
    registerAtlas(manager, makeAtlasDef(), texture);
    const table = AtlasAverages.of(texture)!;

    data.set([255, 255, 255, 255]);
    texture.needsUpdate = true;
    manager.refreshAverages();

    assert.equal(table.refresh(), false);
    assert.equal(table.average(0, 0, 1, 1)[0], 1);
  });
});
