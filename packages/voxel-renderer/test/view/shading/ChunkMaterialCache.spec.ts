// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ChunkMaterialCache } from "../../../src/view/shading/ChunkMaterialCache.ts";
import { BlockSurface } from "../../../src/document/blocks/index.ts";
import { ChunkGeometryKey, FaceTemplateTable } from "../../../src/view/meshing/index.ts";
import { MaterialGroupList } from "../../../src/document/materials/index.ts";
import { BlocksetAtlases } from "../../../src/view/atlases/index.ts";
import { AtlasAverages } from "../../../src/view/atlases/AtlasAverages.ts";
import { makeAtlasDef, registerAtlas } from "../../helpers/atlas.ts";
import { readableTexture } from "../../helpers/mockTexture.ts";

// CONSTANTS
const kBlend = new BlockSurface({ alphaMode: "blend" });

function createGeometryKey(
  blocksetId: string,
  surface = new BlockSurface()
): ChunkGeometryKey {
  return new ChunkGeometryKey(blocksetId, surface);
}

function makeCache(
  options: Partial<ConstructorParameters<typeof ChunkMaterialCache>[0]> = {}
): ChunkMaterialCache {
  const atlases = new BlocksetAtlases();
  registerAtlas(atlases);

  return new ChunkMaterialCache({
    atlases,
    faceTemplates: new FaceTemplateTable(),
    ...options
  });
}

describe("ChunkMaterialCache — resolve", () => {
  it("defaults to a lambert material", () => {
    const material = makeCache().resolve(createGeometryKey("atlas"));
    assert.ok(material instanceof THREE.MeshLambertMaterial);
  });

  it("builds a standard material when asked", () => {
    const material = makeCache({ type: "standard" }).resolve(createGeometryKey("atlas"));
    assert.ok(material instanceof THREE.MeshStandardMaterial);
  });

  it("shares one material across calls with the same key", () => {
    const cache = makeCache();
    assert.equal(cache.resolve(createGeometryKey("atlas")), cache.resolve(createGeometryKey("atlas")));
  });

  it("separates the cutout variant from the plain one", () => {
    const cache = makeCache();
    assert.notEqual(
      cache.resolve(createGeometryKey("atlas")),
      cache.resolve(createGeometryKey("atlas", kBlend))
    );
  });

  it("renders and casts opaque geometry front-side only, without blending", () => {
    const material = makeCache().resolve(createGeometryKey("atlas"));

    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, !material.transparent);
    assert.equal(material.side, THREE.FrontSide);
    assert.equal(material.shadowSide, THREE.FrontSide);
  });

  it("shows and casts both sides of cutout geometry even when opaque", () => {
    const material = makeCache().resolve(createGeometryKey("atlas", kBlend));

    assert.equal(material.side, THREE.DoubleSide);
    assert.equal(material.shadowSide, THREE.DoubleSide);
  });

  it("blends cutout geometry without writing depth", () => {
    const material = makeCache().resolve(createGeometryKey("atlas", kBlend));

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, !material.transparent);
  });

  it("does not apply a global cutoff to opaque geometry", () => {
    assert.equal(makeCache().resolve(createGeometryKey("atlas")).alphaTest, 0);
  });

  it("hands each new material to the customizer with its blockset id", () => {
    const seen: string[] = [];
    const cache = makeCache({
      customizer: (_material, blocksetId) => seen.push(blocksetId)
    });

    cache.resolve(createGeometryKey("atlas"));
    cache.resolve(createGeometryKey("atlas"));

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

    const plain = cache.resolve(createGeometryKey("atlas"));
    const gold = cache.resolve(createGeometryKey("atlas", kGold));

    assert.ok(plain instanceof THREE.MeshLambertMaterial);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.roughness, 0.2);
    assert.equal(gold.metalness, 1);
  });

  it("keeps the view material for a group the document does not define", () => {
    const cache = makeCache({ materialGroups: new MaterialGroupList() });

    assert.ok(
      cache.resolve(createGeometryKey("atlas", kGold)) instanceof THREE.MeshLambertMaterial
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

    const gold = cache.resolve(createGeometryKey("atlas", kGold));
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 0.5);
  });

  it("updates a changed finish in place", () => {
    const materialGroups = new MaterialGroupList([{ id: "gold" }]);
    const cache = makeCache({ materialGroups });
    const gold = cache.resolve(createGeometryKey("atlas", kGold));

    materialGroups.define({ id: "gold", metalness: 1 });

    assert.equal(cache.refreshGroup("gold"), false);
    assert.equal(cache.resolve(createGeometryKey("atlas", kGold)), gold);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 1);
  });

  it("evicts the group materials when the group appears or goes", () => {
    const materialGroups = new MaterialGroupList();
    const cache = makeCache({ materialGroups });
    const plain = cache.resolve(createGeometryKey("atlas"));
    const before = cache.resolve(createGeometryKey("atlas", kGold));

    materialGroups.define({ id: "gold" });
    assert.equal(cache.refreshGroup("gold"), true);
    const after = cache.resolve(createGeometryKey("atlas", kGold));
    assert.notEqual(after, before);
    assert.ok(after instanceof THREE.MeshStandardMaterial);
    assert.equal(cache.resolve(createGeometryKey("atlas")), plain);

    materialGroups.remove("gold");
    assert.equal(cache.refreshGroup("gold"), true);
    assert.ok(
      cache.resolve(createGeometryKey("atlas", kGold)) instanceof THREE.MeshLambertMaterial
    );
  });
});

describe("ChunkMaterialCache — invalidate", () => {
  it("rebuilds the materials of one blockset", () => {
    const cache = makeCache();
    const before = cache.resolve(createGeometryKey("atlas"));

    cache.invalidate("atlas");

    assert.notEqual(cache.resolve(createGeometryKey("atlas")), before);
  });

  it("keeps the materials of other blocksets", () => {
    const atlases = new BlocksetAtlases();
    registerAtlas(atlases);
    registerAtlas(atlases, makeAtlasDef({ id: "other", src: "/other.png" }));
    const cache = new ChunkMaterialCache({
      atlases,
      faceTemplates: new FaceTemplateTable()
    });
    const kept = cache.resolve(createGeometryKey("other"));

    cache.invalidate("atlas");

    assert.equal(cache.resolve(createGeometryKey("other")), kept);
  });

  it("rebuilds every material without a blockset id", () => {
    const cache = makeCache();
    const before = cache.resolve(createGeometryKey("atlas"));

    cache.invalidate();

    assert.notEqual(cache.resolve(createGeometryKey("atlas")), before);
  });
});

describe("ChunkMaterialCache — tile averaging", () => {
  function readableAtlasCache(
    tileAveraging?: boolean
  ) {
    const atlases = new BlocksetAtlases();
    const texture = readableTexture();
    registerAtlas(atlases, makeAtlasDef(), texture);
    const cache = new ChunkMaterialCache({
      atlases,
      faceTemplates: new FaceTemplateTable(),
      tileAveraging
    });

    return { cache, texture };
  }

  it("builds the average table of a readable atlas by default", () => {
    const { cache, texture } = readableAtlasCache();
    assert.equal(cache.tileAveraging, true);

    cache.resolve(createGeometryKey("atlas"));

    assert.ok(AtlasAverages.peek(texture));
  });

  it("skips the table when averaging is off", () => {
    const { cache, texture } = readableAtlasCache(false);

    cache.resolve(createGeometryKey("atlas"));

    assert.equal(AtlasAverages.peek(texture), undefined);
  });
});
