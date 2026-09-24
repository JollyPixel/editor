// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ChunkMaterialCache } from "../../src/render/index.ts";
import { BlockSurface } from "../../src/blocks/index.ts";
import { MaterialGroupList } from "../../src/materials/index.ts";
import {
  AtlasAverages,
  TilesetManager
} from "../../src/tileset/index.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../helpers/atlas.ts";
import { readableTexture } from "../helpers/mockTexture.ts";

function makeCache(
  options: Partial<ConstructorParameters<typeof ChunkMaterialCache>[0]> = {}
): ChunkMaterialCache {
  const tilesetManager = new TilesetManager();
  registerAtlas(tilesetManager);

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
    assert.equal(material.depthWrite, !material.transparent);
    assert.equal(material.side, THREE.FrontSide);
    assert.equal(material.opacity, 1);
  });

  it("blends a translucent layer front-side only, without writing depth", () => {
    const material = makeCache().resolve("atlas", 0.5);

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, !material.transparent);
    assert.equal(material.side, THREE.FrontSide);
    assert.equal(material.opacity, 0.5);
  });

  it("shows both sides of cutout geometry even when opaque", () => {
    assert.equal(makeCache().resolve("atlas", 1, true).side, THREE.DoubleSide);
  });

  it("blends cutout geometry on an opaque layer, without writing depth", () => {
    const material = makeCache().resolve("atlas", 1, true);

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, !material.transparent);
    assert.equal(material.opacity, 1);
  });

  it("preserves nearby opacities independently", () => {
    const cache = makeCache();
    assert.notEqual(cache.resolve("atlas", 0.5), cache.resolve("atlas", 0.51));
  });

  it("reserves a bucket of its own for exactly opaque layers", () => {
    const cache = makeCache();
    assert.notEqual(cache.resolve("atlas", 1), cache.resolve("atlas", 0.99));
  });

  it("does not apply a global cutoff to opaque geometry", () => {
    assert.equal(makeCache().resolve("atlas", 1).alphaTest, 0);
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

describe("ChunkMaterialCache — material groups", () => {
  const kGold = new BlockSurface({ materialGroup: "gold" });

  it("gives a defined group a standard material carrying its finish", () => {
    const materialGroups = new MaterialGroupList([
      { id: "gold", roughness: 0.2, metalness: 1 }
    ]);
    const cache = makeCache({ materialGroups });

    const plain = cache.resolve("atlas", 1);
    const gold = cache.resolve("atlas", 1, kGold);

    assert.ok(plain instanceof THREE.MeshLambertMaterial);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.roughness, 0.2);
    assert.equal(gold.metalness, 1);
  });

  it("keeps the view material for a group the document does not define", () => {
    const cache = makeCache({ materialGroups: new MaterialGroupList() });

    assert.ok(
      cache.resolve("atlas", 1, kGold) instanceof THREE.MeshLambertMaterial
    );
  });

  it("runs the customizer after the finish", () => {
    const materialGroups = new MaterialGroupList([
      { id: "gold", metalness: 1 }
    ]);
    const cache = makeCache({
      materialGroups,
      customizer: (material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.metalness = 0.5;
        }
      }
    });

    const gold = cache.resolve("atlas", 1, kGold);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 0.5);
  });

  it("updates a changed finish in place", () => {
    const materialGroups = new MaterialGroupList([{ id: "gold" }]);
    const cache = makeCache({ materialGroups });
    const gold = cache.resolve("atlas", 1, kGold);

    materialGroups.define({ id: "gold", metalness: 1 });

    assert.equal(cache.refreshGroup("gold"), false);
    assert.equal(cache.resolve("atlas", 1, kGold), gold);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 1);
  });

  it("evicts the group materials when the group appears or goes", () => {
    const materialGroups = new MaterialGroupList();
    const cache = makeCache({ materialGroups });
    const plain = cache.resolve("atlas", 1);
    const before = cache.resolve("atlas", 1, kGold);

    materialGroups.define({ id: "gold" });
    assert.equal(cache.refreshGroup("gold"), true);
    const after = cache.resolve("atlas", 1, kGold);
    assert.notEqual(after, before);
    assert.ok(after instanceof THREE.MeshStandardMaterial);
    assert.equal(cache.resolve("atlas", 1), plain);

    materialGroups.remove("gold");
    assert.equal(cache.refreshGroup("gold"), true);
    assert.ok(
      cache.resolve("atlas", 1, kGold) instanceof THREE.MeshLambertMaterial
    );
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
    registerAtlas(tilesetManager);
    registerAtlas(tilesetManager, makeAtlasDef({ id: "other", src: "/other.png" }));
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

describe("ChunkMaterialCache — tile averaging", () => {
  function readableAtlasCache(
    tileAveraging?: boolean
  ) {
    const tilesetManager = new TilesetManager();
    const texture = readableTexture();
    registerAtlas(tilesetManager, makeAtlasDef(), texture);
    const cache = new ChunkMaterialCache({
      tilesetManager,
      tileAveraging
    });

    return { cache, texture };
  }

  it("builds the average table of a readable atlas by default", () => {
    const { cache, texture } = readableAtlasCache();
    assert.equal(cache.tileAveraging, true);

    cache.resolve("atlas", 1);

    assert.ok(AtlasAverages.peek(texture));
  });

  it("skips the table when averaging is off", () => {
    const { cache, texture } = readableAtlasCache(false);

    cache.resolve("atlas", 1);

    assert.equal(AtlasAverages.peek(texture), undefined);
  });

  it("falls back to plain sampling when the atlas cannot be read", () => {
    const material = makeCache().resolve("atlas", 1);

    assert.ok(material.map);
    assert.ok((material as { colorNode?: unknown; }).colorNode);
  });
});
