// Import Node.js Dependencies
import {
  describe,
  it,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { type TilesetDefinition, TilesetManager } from "../../src/tileset/index.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { approxEqual } from "../helpers/math.ts";

function makeDef(
  options: Pick<TilesetDefinition, "id" | "tileSize" | "cols" | "rows">
): TilesetDefinition {
  const { id, tileSize, cols, rows } = options;

  return { id, src: `/assets/${id}.png`, tileSize, cols, rows };
}

describe("TilesetManager.registerTexture", () => {
  it("sets defaultTilesetId on the first registration", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }), mockTexture(64, 64));
    assert.equal(manager.defaultTilesetId, "terrain");
  });

  it("first registered tileset remains default even after a second registration", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }), mockTexture(64, 64));
    manager.registerTexture(makeDef({ id: "extras", tileSize: 16, cols: 2, rows: 2 }), mockTexture(32, 32));
    assert.equal(manager.defaultTilesetId, "terrain");
  });

  it("returns the atlas it registered", () => {
    const manager = new TilesetManager();
    const atlas = manager.registerTexture(
      makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }),
      mockTexture(64, 64)
    );

    assert.equal(manager.atlas("terrain"), atlas);
  });

  it("bumps the version so cached UV regions are invalidated", () => {
    const manager = new TilesetManager();
    const before = manager.version;
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16 }), mockTexture(64, 64));

    assert.ok(manager.version > before);
  });
});

describe("TilesetManager.has", () => {
  it("is false while nothing is registered", () => {
    const manager = new TilesetManager();
    assert.equal(manager.has(), false);
    assert.equal(manager.has("terrain"), false);
  });

  it("reports the default tileset when no ID is given", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16 }), mockTexture(64, 64));

    assert.equal(manager.has(), true);
    assert.equal(manager.has("terrain"), true);
    assert.equal(manager.has("unknown"), false);
  });
});

describe("TilesetManager.atlas", () => {
  it("throws when no tilesets are loaded", () => {
    const manager = new TilesetManager();
    assert.throws(
      () => manager.atlas(),
      /no tilesets have been loaded/
    );
  });

  it("throws for an unknown explicit tilesetId", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }), mockTexture(64, 64));
    assert.throws(
      () => manager.atlas("unknown"),
      /tileset "unknown" is not loaded/
    );
  });

  it("returns the registered texture for the default tileset", () => {
    const manager = new TilesetManager();
    const tex = mockTexture(64, 64);
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }), tex);

    assert.equal(manager.atlas().texture, tex);
    assert.equal(manager.atlas().sourceTexture, tex);
  });

  it("returns the atlas for an explicit tilesetId", () => {
    const manager = new TilesetManager();
    const tex1 = mockTexture(64, 64);
    const tex2 = mockTexture(32, 32);
    manager.registerTexture(makeDef({ id: "a", tileSize: 16, cols: 4, rows: 4 }), tex1);
    manager.registerTexture(makeDef({ id: "b", tileSize: 16, cols: 2, rows: 2 }), tex2);

    assert.equal(manager.atlas("b").texture, tex2);
  });
});

describe("TilesetManager UV lookup", () => {
  describe("UV computation — 4-col 4-row atlas (tileSize=16, image=64×64)", () => {
    let manager: TilesetManager;

    beforeEach(() => {
      manager = new TilesetManager();
      manager.registerTexture(
        makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }),
        mockTexture(64, 64)
      );
    });

    it("tile (col=0, row=0): offsetU/offsetV/scale (inset by half-texel)", () => {
      const uv = manager.atlas().uvFor(0, 0);
      assert.ok(approxEqual(uv.offsetU, 0.0078125));
      assert.ok(approxEqual(uv.offsetV, 0.7578125));
      assert.ok(approxEqual(uv.scaleU, 15 / 64));
      assert.ok(approxEqual(uv.scaleV, 15 / 64));
    });

    it("tile (col=1, row=0): offsetU/offsetV (inset by half-texel)", () => {
      const uv = manager.atlas().uvFor(1, 0);
      assert.ok(approxEqual(uv.offsetU, 0.2578125));
      assert.ok(approxEqual(uv.offsetV, 0.7578125));
    });

    it("tile (col=0, row=3) is the bottom row: offsetV (inset by half-texel)", () => {
      const uv = manager.atlas().uvFor(0, 3);
      assert.ok(approxEqual(uv.offsetV, 0.0078125));
    });

    it("tile (col=3, row=3): offsetU/offsetV (inset by half-texel)", () => {
      const uv = manager.atlas().uvFor(3, 3);
      assert.ok(approxEqual(uv.offsetU, 0.7578125));
      assert.ok(approxEqual(uv.offsetV, 0.0078125));
    });
  });

  describe("UV computation — 2-col 2-row atlas (tileSize=16, image=32×32)", () => {
    let manager: TilesetManager;

    beforeEach(() => {
      manager = new TilesetManager();
      manager.registerTexture(makeDef({ id: "small", tileSize: 16, cols: 2, rows: 2 }), mockTexture(32, 32));
    });

    it("scaleU = scaleV (inset by half-texel)", () => {
      const uv = manager.atlas().uvFor(0, 0);
      assert.ok(approxEqual(uv.scaleU, 15 / 32));
      assert.ok(approxEqual(uv.scaleV, 15 / 32));
    });

    it("tile (col=1, row=1): offsetU/offsetV (inset by half-texel)", () => {
      const uv = manager.atlas().uvFor(1, 1);
      assert.ok(approxEqual(uv.offsetU, 0.515625));
      assert.ok(approxEqual(uv.offsetV, 0.015625));
    });
  });

  it("uses the atlas grid of the requested tileset", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }), mockTexture(64, 64));
    manager.registerTexture(makeDef({ id: "walls", tileSize: 16, cols: 2, rows: 2 }), mockTexture(32, 32));

    const uv = manager.atlas("walls").uvFor(0, 0);
    assert.ok(approxEqual(uv.scaleU, 15 / 32));
  });
});

describe("TilesetManager.definitions", () => {
  it("returns the declared definitions in declaration order", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "a", tileSize: 16, cols: 4, rows: 4 }), mockTexture(64, 64));
    manager.registerTexture(makeDef({ id: "b", tileSize: 16, cols: 2, rows: 2 }), mockTexture(32, 32));

    const defs = manager.definitions();
    assert.deepEqual(defs.map((def) => def.id), ["a", "b"]);
  });

  it("keeps a declared tileset without texture", () => {
    const manager = new TilesetManager();
    manager.tilesets.add(makeDef({ id: "later", tileSize: 16 }));

    assert.deepEqual(manager.definitions().map((def) => def.id), ["later"]);
    assert.equal(manager.defaultTilesetId, "later");
    assert.equal(manager.has("later"), false);
  });

  it("resolves the atlas cols/rows from the image when not provided", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "auto", tileSize: 16 }), mockTexture(64, 32));

    const { def } = manager.atlas("auto");
    assert.equal(def.cols, 4);
    assert.equal(def.rows, 2);
  });
});

describe("TilesetManager.dispose", () => {
  it("clears all tilesets and resets defaultTilesetId", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16, cols: 4, rows: 4 }), mockTexture(64, 64));
    manager.dispose();

    assert.equal(manager.defaultTilesetId, null);
    assert.equal(manager.definitions().length, 0);
    assert.equal(manager.has("terrain"), false);
  });
});

describe("TilesetManager.registerTexture replacement", () => {
  it("disposes the atlas it replaces and keeps the declared tile size", () => {
    const manager = new TilesetManager();
    let disposed = 0;
    const first = mockTexture(64, 64);
    first.dispose = () => {
      disposed++;
    };
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16 }), first);
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 32 }), mockTexture(64, 64));

    assert.equal(disposed, 1);
    assert.equal(manager.atlas("terrain").def.tileSize, 16);
    assert.equal(manager.definitions().length, 1);
  });
});

describe("TilesetManager.unregisterTexture", () => {
  it("returns false for an unknown tileset", () => {
    const manager = new TilesetManager();

    assert.equal(manager.unregisterTexture("terrain"), false);
  });

  it("removes the atlas, keeps the declaration and bumps the version", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "terrain", tileSize: 16 }), mockTexture(64, 64));
    const before = manager.version;

    assert.equal(manager.unregisterTexture("terrain"), true);
    assert.equal(manager.has("terrain"), false);
    assert.equal(manager.defaultTilesetId, "terrain");
    assert.ok(manager.version > before);
  });
});

describe("TilesetManager.syncAtlases", () => {
  it("drops the atlas of an undeclared tileset", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "a", tileSize: 16 }), mockTexture(64, 64));
    manager.registerTexture(makeDef({ id: "b", tileSize: 16 }), mockTexture(64, 64));
    manager.tilesets.remove("a");

    assert.deepEqual(manager.syncAtlases(), ["a"]);
    assert.equal(manager.has("a"), false);
    assert.equal(manager.defaultTilesetId, "b");
  });

  it("rebuilds a resized atlas on the same source texture", () => {
    const manager = new TilesetManager({ padding: 0 });
    let disposed = 0;
    const texture = mockTexture(64, 64);
    texture.dispose = () => {
      disposed++;
    };
    manager.registerTexture(makeDef({ id: "a", tileSize: 16 }), texture);
    manager.tilesets.resize("a", 32);

    assert.deepEqual(manager.syncAtlases(), ["a"]);
    const atlas = manager.atlas("a");
    assert.equal(atlas.def.tileSize, 32);
    assert.equal(atlas.def.cols, 2);
    assert.equal(atlas.sourceTexture, texture);
    assert.equal(disposed, 0);
  });

  it("returns nothing when atlases match the declarations", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef({ id: "a", tileSize: 16 }), mockTexture(64, 64));
    const before = manager.version;

    assert.deepEqual(manager.syncAtlases(), []);
    assert.equal(manager.version, before);
  });
});
