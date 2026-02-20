// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TilesetManager } from "../../src/tileset/TilesetManager.ts";

// CONSTANTS
const kEpsilon = 1e-10;

function approxEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < kEpsilon;
}

/**
 * Creates a minimal mock THREE.Texture with a synthetic image.
 * registerTexture() sets magFilter/minFilter/colorSpace/generateMipmaps on the object,
 * then reads image.width and image.height. A plain object with those properties is sufficient.
 */
function mockTexture(width: number, height: number): any {
  return {
    magFilter: 0,
    minFilter: 0,
    colorSpace: "",
    generateMipmaps: true,
    image: { width, height },
    dispose() {
      // No-op for testing; real THREE.Texture would release GPU resources here.
    }
  };
}

/**
 * Minimal tileset definition.
 */
// eslint-disable-next-line max-params
function makeDef(
  id: string,
  tileSize: number,
  cols?: number,
  rows?: number
) {
  return { id, src: `/assets/${id}.png`, tileSize, cols, rows };
}

describe("TilesetManager.registerTexture", () => {
  it("sets defaultTilesetId on the first registration", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));
    assert.equal(manager.defaultTilesetId, "terrain");
  });

  it("first registered tileset remains default even after a second registration", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));
    manager.registerTexture(makeDef("extras", 16, 2, 2), mockTexture(32, 32));
    assert.equal(manager.defaultTilesetId, "terrain");
  });

  it("resolves cols/rows from image when not provided", () => {
    // tileSize=16, image=64×32 → cols=4, rows=2
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("auto", 16), mockTexture(64, 32));
    const defs = manager.getDefinitions();
    assert.equal(defs[0].cols, 4);
    assert.equal(defs[0].rows, 2);
  });

  it("explicit cols/rows override image-derived values", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("explicit", 16, 8, 8), mockTexture(64, 32));
    const defs = manager.getDefinitions();
    assert.equal(defs[0].cols, 8);
    assert.equal(defs[0].rows, 8);
  });
});

describe("TilesetManager.getTileUV", () => {
  it("throws when no tilesets are loaded", () => {
    const manager = new TilesetManager();
    assert.throws(
      () => manager.getTileUV({ col: 0, row: 0 }),
      /no tilesets have been loaded/
    );
  });

  it("throws for unknown explicit tilesetId", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));
    assert.throws(
      () => manager.getTileUV({ col: 0, row: 0, tilesetId: "unknown" }),
      /tileset "unknown" is not loaded/
    );
  });

  it("uses default tileset when tilesetId is omitted", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));
    // Should not throw
    assert.doesNotThrow(() => manager.getTileUV({ col: 0, row: 0 }));
  });

  describe("UV computation — 4-col 4-row atlas (tileSize=16, image=64×64)", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));

    it("tile (col=0, row=0): offsetU/offsetV/scale (inset by half-texel)", () => {
      // halfTexel = 0.5 / (cols*tileSize) = 0.5 / 64 = 0.0078125
      // offsetU = 0 + halfTexel = 0.0078125
      // offsetV = 1 - (0+1)/4 + halfTexel = 0.7578125
      // scaleU = scaleV = (tileSize - 1) / imgW = 15/64 = 0.234375
      const uv = manager.getTileUV({ col: 0, row: 0 });
      assert.ok(approxEqual(uv.offsetU, 0.0078125));
      assert.ok(approxEqual(uv.offsetV, 0.7578125));
      assert.ok(approxEqual(uv.scaleU, 15 / 64));
      assert.ok(approxEqual(uv.scaleV, 15 / 64));
    });

    it("tile (col=1, row=0): offsetU/offsetV (inset by half-texel)", () => {
      // offsetU = 1*16/64 + halfTexel = 0.2578125
      // offsetV = 0.7578125
      const uv = manager.getTileUV({ col: 1, row: 0 });
      assert.ok(approxEqual(uv.offsetU, 0.2578125));
      assert.ok(approxEqual(uv.offsetV, 0.7578125));
    });

    it("tile (col=0, row=3) is the bottom row: offsetV (inset by half-texel)", () => {
      // offsetV = 1 - (3+1)/4 + halfTexel = 0.0078125
      const uv = manager.getTileUV({ col: 0, row: 3 });
      assert.ok(approxEqual(uv.offsetV, 0.0078125));
    });

    it("tile (col=3, row=3): offsetU/offsetV (inset by half-texel)", () => {
      // offsetU = 3*16/64 + halfTexel = 0.7578125
      // offsetV = halfTexel = 0.0078125
      const uv = manager.getTileUV({ col: 3, row: 3 });
      assert.ok(approxEqual(uv.offsetU, 0.7578125));
      assert.ok(approxEqual(uv.offsetV, 0.0078125));
    });
  });

  describe("UV computation — 2-col 2-row atlas (tileSize=16, image=32×32)", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("small", 16, 2, 2), mockTexture(32, 32));

    it("scaleU = scaleV (inset by half-texel)", () => {
      // cols=2, tileSize=16 => imgW=32, halfTexel=0.5/32=0.015625
      // scale = (16 - 1) / 32 = 15/32 = 0.46875
      const uv = manager.getTileUV({ col: 0, row: 0 });
      assert.ok(approxEqual(uv.scaleU, 15 / 32));
      assert.ok(approxEqual(uv.scaleV, 15 / 32));
    });

    it("tile (col=1, row=1): offsetU/offsetV (inset by half-texel)", () => {
      // offsetU = 1*16/32 + halfTexel = 0.515625
      // offsetV = 1 - ((1+1)*16/32) + halfTexel = 0.015625
      const uv = manager.getTileUV({ col: 1, row: 1 });
      assert.ok(approxEqual(uv.offsetU, 0.515625));
      assert.ok(approxEqual(uv.offsetV, 0.015625));
    });
  });

  it("uses explicit tilesetId when provided", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));
    manager.registerTexture(makeDef("walls", 16, 2, 2), mockTexture(32, 32));

    const uv = manager.getTileUV({ col: 0, row: 0, tilesetId: "walls" });
    // walls is 2-col, 2-row → scaleU=(tileSize-1)/(cols*tileSize)=15/32
    assert.ok(approxEqual(uv.scaleU, 15 / 32));
  });
});

describe("TilesetManager.getTexture", () => {
  it("returns the registered texture for the default tileset", () => {
    const manager = new TilesetManager();
    const tex = mockTexture(64, 64);
    manager.registerTexture(makeDef("terrain", 16, 4, 4), tex);
    assert.equal(manager.getTexture(), tex);
  });

  it("returns the texture for an explicit tilesetId", () => {
    const manager = new TilesetManager();
    const tex1 = mockTexture(64, 64);
    const tex2 = mockTexture(32, 32);
    manager.registerTexture(makeDef("a", 16, 4, 4), tex1);
    manager.registerTexture(makeDef("b", 16, 2, 2), tex2);
    assert.equal(manager.getTexture("b"), tex2);
  });

  it("returns undefined when no tilesets are loaded", () => {
    const manager = new TilesetManager();
    assert.equal(manager.getTexture(), undefined);
  });
});

describe("TilesetManager.getDefinitions", () => {
  it("returns one definition per registered tileset", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("a", 16, 4, 4), mockTexture(64, 64));
    manager.registerTexture(makeDef("b", 16, 2, 2), mockTexture(32, 32));
    const defs = manager.getDefinitions();
    assert.equal(defs.length, 2);
    const ids = defs.map((d) => d.id);
    assert.ok(ids.includes("a"));
    assert.ok(ids.includes("b"));
  });
});

describe("TilesetManager.dispose", () => {
  it("clears all tilesets and resets defaultTilesetId", () => {
    const manager = new TilesetManager();
    manager.registerTexture(makeDef("terrain", 16, 4, 4), mockTexture(64, 64));
    manager.dispose();
    assert.equal(manager.defaultTilesetId, null);
    assert.equal(manager.getDefinitions().length, 0);
  });
});
