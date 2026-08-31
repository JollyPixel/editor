// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ChunkMaterialCache } from "../../src/render/ChunkMaterialCache.ts";
import { TilesetManager } from "../../src/tileset/TilesetManager.ts";
import { mockTexture } from "../helpers/mockTexture.ts";
import { makeAtlasDef } from "../helpers/atlas.ts";

function makeCache(
  options: Partial<ConstructorParameters<typeof ChunkMaterialCache>[0]> = {}
): ChunkMaterialCache {
  const tilesetManager = new TilesetManager();
  tilesetManager.registerTexture(makeAtlasDef(), mockTexture());

  return new ChunkMaterialCache({
    tilesetManager,
    ...options
  });
}

describe("ChunkMaterialCache — resolve", () => {
  it("defaults to a lambert material", () => {
    const material = makeCache().resolve("atlas", 1);
    assert.ok(material instanceof THREE.MeshLambertMaterial);
  });

  it("builds a standard material when asked", () => {
    const material = makeCache({ type: "standard" }).resolve("atlas", 1);
    assert.ok(material instanceof THREE.MeshStandardMaterial);
  });

  it("shares one material across calls with the same key", () => {
    const cache = makeCache();
    assert.equal(cache.resolve("atlas", 1), cache.resolve("atlas", 1));
  });

  it("separates the cutout variant from the plain one", () => {
    const cache = makeCache();
    assert.notEqual(cache.resolve("atlas", 1), cache.resolve("atlas", 1, true));
  });

  it("renders an opaque layer front-side only, without blending", () => {
    const material = makeCache().resolve("atlas", 1);

    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, true);
    assert.equal(material.side, THREE.FrontSide);
    assert.equal(material.opacity, 1);
  });

  it("blends a translucent layer from both sides", () => {
    const material = makeCache().resolve("atlas", 0.5);

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.equal(material.side, THREE.DoubleSide);
    assert.equal(material.opacity, 0.5);
  });

  it("shows both sides of cutout geometry even when opaque", () => {
    assert.equal(makeCache().resolve("atlas", 1, true).side, THREE.DoubleSide);
  });

  it("quantizes nearby opacities into one shared bucket", () => {
    const cache = makeCache();
    assert.equal(cache.resolve("atlas", 0.5), cache.resolve("atlas", 0.51));
  });

  it("reserves a bucket of its own for exactly opaque layers", () => {
    const cache = makeCache();
    assert.notEqual(cache.resolve("atlas", 1), cache.resolve("atlas", 0.99));
  });

  it("applies the alpha-test cutoff", () => {
    assert.equal(makeCache({ alphaTest: 0.4 }).resolve("atlas", 1).alphaTest, 0.4);
  });

  it("hands each new material to the customizer with its tileset id", () => {
    const seen: string[] = [];
    const cache = makeCache({
      customizer: (_material, tilesetId) => seen.push(tilesetId)
    });

    cache.resolve("atlas", 1);
    cache.resolve("atlas", 1);

    assert.deepEqual(seen, ["atlas"]);
  });
});

describe("ChunkMaterialCache — invalidate", () => {
  it("rebuilds the materials of one tileset", () => {
    const cache = makeCache();
    const before = cache.resolve("atlas", 1);

    cache.invalidate("atlas");

    assert.notEqual(cache.resolve("atlas", 1), before);
  });

  it("keeps the materials of other tilesets", () => {
    const tilesetManager = new TilesetManager();
    tilesetManager.registerTexture(makeAtlasDef(), mockTexture());
    tilesetManager.registerTexture(
      makeAtlasDef({ id: "other", src: "/other.png" }),
      mockTexture()
    );
    const cache = new ChunkMaterialCache({ tilesetManager });
    const kept = cache.resolve("other", 1);

    cache.invalidate("atlas");

    assert.equal(cache.resolve("other", 1), kept);
  });

  it("rebuilds every material without a tileset id", () => {
    const cache = makeCache();
    const before = cache.resolve("atlas", 1);

    cache.invalidate();

    assert.notEqual(cache.resolve("atlas", 1), before);
  });
});
