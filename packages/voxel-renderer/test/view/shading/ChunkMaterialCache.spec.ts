// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ChunkMaterialCache } from "../../../src/view/shading/ChunkMaterialCache.ts";
import { BlockSurface } from "../../../src/document/blocks/index.ts";
import {
  ChunkGeometryKey,
  FaceTemplateTable
} from "../../../src/view/meshing/index.ts";
import { MaterialGroupList } from "../../../src/document/materials/index.ts";
import { AtlasAverages, TilesetAtlases } from "../../../src/view/atlases/index.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../../helpers/atlas.ts";
import { readableTexture } from "../../helpers/mockTexture.ts";

// CONSTANTS
const kBlend = new BlockSurface({ alphaMode: "blend" });

function keyOf(
  tilesetId: string,
  surface = new BlockSurface()
): ChunkGeometryKey {
  return new ChunkGeometryKey(tilesetId, surface);
}

function makeCache(
  options: Partial<ConstructorParameters<typeof ChunkMaterialCache>[0]> = {}
): ChunkMaterialCache {
  const atlases = new TilesetAtlases();
  registerAtlas(atlases);

  return new ChunkMaterialCache({
    atlases,
    faceTemplates: new FaceTemplateTable(),
    ...options
  });
}

describe("ChunkMaterialCache — resolve", () => {
  it("defaults to a lambert material", () => {
    const material = makeCache().resolve(keyOf("atlas"));
    assert.ok(material instanceof THREE.MeshLambertMaterial);
  });

  it("builds a standard material when asked", () => {
    const material = makeCache({ type: "standard" }).resolve(keyOf("atlas"));
    assert.ok(material instanceof THREE.MeshStandardMaterial);
  });

  it("shares one material across calls with the same key", () => {
    const cache = makeCache();
    assert.equal(cache.resolve(keyOf("atlas")), cache.resolve(keyOf("atlas")));
  });

  it("separates the cutout variant from the plain one", () => {
    const cache = makeCache();
    assert.notEqual(cache.resolve(keyOf("atlas")), cache.resolve(keyOf("atlas", kBlend)));
  });

  it("renders opaque geometry front-side only, without blending", () => {
    const material = makeCache().resolve(keyOf("atlas"));

    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, !material.transparent);
    assert.equal(material.side, THREE.FrontSide);
  });

  it("shows both sides of cutout geometry even when opaque", () => {
    assert.equal(makeCache().resolve(keyOf("atlas", kBlend)).side, THREE.DoubleSide);
  });

  it("blends cutout geometry without writing depth", () => {
    const material = makeCache().resolve(keyOf("atlas", kBlend));

    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, !material.transparent);
  });

  it("does not apply a global cutoff to opaque geometry", () => {
    assert.equal(makeCache().resolve(keyOf("atlas")).alphaTest, 0);
  });

  it("hands each new material to the customizer with its tileset id", () => {
    const seen: string[] = [];
    const cache = makeCache({
      customizer: (_material, tilesetId) => seen.push(tilesetId)
    });

    cache.resolve(keyOf("atlas"));
    cache.resolve(keyOf("atlas"));

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

    const plain = cache.resolve(keyOf("atlas"));
    const gold = cache.resolve(keyOf("atlas", kGold));

    assert.ok(plain instanceof THREE.MeshLambertMaterial);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.roughness, 0.2);
    assert.equal(gold.metalness, 1);
  });

  it("keeps the view material for a group the document does not define", () => {
    const cache = makeCache({ materialGroups: new MaterialGroupList() });

    assert.ok(
      cache.resolve(keyOf("atlas", kGold)) instanceof THREE.MeshLambertMaterial
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

    const gold = cache.resolve(keyOf("atlas", kGold));
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 0.5);
  });

  it("updates a changed finish in place", () => {
    const materialGroups = new MaterialGroupList([{ id: "gold" }]);
    const cache = makeCache({ materialGroups });
    const gold = cache.resolve(keyOf("atlas", kGold));

    materialGroups.define({ id: "gold", metalness: 1 });

    assert.equal(cache.refreshGroup("gold"), false);
    assert.equal(cache.resolve(keyOf("atlas", kGold)), gold);
    assert.ok(gold instanceof THREE.MeshStandardMaterial);
    assert.equal(gold.metalness, 1);
  });

  it("evicts the group materials when the group appears or goes", () => {
    const materialGroups = new MaterialGroupList();
    const cache = makeCache({ materialGroups });
    const plain = cache.resolve(keyOf("atlas"));
    const before = cache.resolve(keyOf("atlas", kGold));

    materialGroups.define({ id: "gold" });
    assert.equal(cache.refreshGroup("gold"), true);
    const after = cache.resolve(keyOf("atlas", kGold));
    assert.notEqual(after, before);
    assert.ok(after instanceof THREE.MeshStandardMaterial);
    assert.equal(cache.resolve(keyOf("atlas")), plain);

    materialGroups.remove("gold");
    assert.equal(cache.refreshGroup("gold"), true);
    assert.ok(
      cache.resolve(keyOf("atlas", kGold)) instanceof THREE.MeshLambertMaterial
    );
  });
});

describe("ChunkMaterialCache — invalidate", () => {
  it("rebuilds the materials of one tileset", () => {
    const cache = makeCache();
    const before = cache.resolve(keyOf("atlas"));

    cache.invalidate("atlas");

    assert.notEqual(cache.resolve(keyOf("atlas")), before);
  });

  it("keeps the materials of other tilesets", () => {
    const atlases = new TilesetAtlases();
    registerAtlas(atlases);
    registerAtlas(atlases, makeAtlasDef({ id: "other", src: "/other.png" }));
    const cache = new ChunkMaterialCache({
      atlases,
      faceTemplates: new FaceTemplateTable()
    });
    const kept = cache.resolve(keyOf("other"));

    cache.invalidate("atlas");

    assert.equal(cache.resolve(keyOf("other")), kept);
  });

  it("rebuilds every material without a tileset id", () => {
    const cache = makeCache();
    const before = cache.resolve(keyOf("atlas"));

    cache.invalidate();

    assert.notEqual(cache.resolve(keyOf("atlas")), before);
  });
});

describe("ChunkMaterialCache — tile averaging", () => {
  function readableAtlasCache(
    tileAveraging?: boolean
  ) {
    const atlases = new TilesetAtlases();
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

    cache.resolve(keyOf("atlas"));

    assert.ok(AtlasAverages.peek(texture));
  });

  it("skips the table when averaging is off", () => {
    const { cache, texture } = readableAtlasCache(false);

    cache.resolve(keyOf("atlas"));

    assert.equal(AtlasAverages.peek(texture), undefined);
  });
});

describe("ChunkMaterialCache — far materials", () => {
  it("keeps the far variant apart from the near one", () => {
    const cache = makeCache();

    assert.notEqual(cache.resolve(keyOf("atlas")), cache.resolve(keyOf("atlas"), true));
    assert.equal(cache.resolve(keyOf("atlas"), true), cache.resolve(keyOf("atlas"), true));
  });

  it("draws far blend surfaces opaque, writing depth", () => {
    const material = makeCache().resolve(keyOf("atlas", kBlend), true);

    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, true);
  });

  it("evicts far variants with their tileset", () => {
    const cache = makeCache();
    const far = cache.resolve(keyOf("atlas"), true);

    cache.invalidate("atlas");

    assert.notEqual(cache.resolve(keyOf("atlas"), true), far);
  });
});

describe("ChunkMaterialCache — alpha to coverage", () => {
  const kMask = new BlockSurface({ alphaMode: "mask" });

  it("is off by default", () => {
    const cache = makeCache();

    assert.equal(cache.alphaToCoverage, false);
    assert.equal(cache.resolve(keyOf("atlas", kMask)).alphaToCoverage, false);
  });

  it("enables it on mask materials only", () => {
    const cache = makeCache({ alphaToCoverage: true });

    assert.equal(cache.resolve(keyOf("atlas", kMask)).alphaToCoverage, true);
    assert.equal(cache.resolve(keyOf("atlas")).alphaToCoverage, false);
    assert.equal(cache.resolve(keyOf("atlas", kBlend)).alphaToCoverage, false);
  });
});

describe("ChunkMaterialCache — vertex pulling", () => {
  it("samples the atlas from its color node only", () => {
    const cache = makeCache();
    const material = cache.resolve(keyOf("atlas"));

    assert.equal(material.map, null);
    assert.ok((material as { colorNode?: unknown; }).colorNode);
  });
});

describe("ChunkMaterialCache — release", () => {
  it("keeps a released material for the next chunk resolving its key", () => {
    const cache = makeCache();
    const material = cache.resolve(keyOf("atlas", kBlend));
    let disposed = false;
    material.addEventListener("dispose", () => {
      disposed = true;
    });

    cache.retain(material);
    cache.release(material);

    assert.equal(disposed, false);
    assert.equal(cache.resolve(keyOf("atlas", kBlend)), material);
  });

  it("disposes the oldest released material past sixteen idle ones", () => {
    const cache = makeCache();
    const materials = Array.from({ length: 17 }, (_, index) => {
      const material = cache.resolve(keyOf(
        "atlas",
        new BlockSurface({ alphaMode: "mask", alphaCutoff: index / 100 })
      ));
      cache.retain(material);

      return material;
    });
    const disposed = new Set<THREE.Material>();
    for (const material of materials) {
      material.addEventListener("dispose", () => disposed.add(material));
    }

    for (const material of materials) {
      cache.release(material);
    }

    assert.deepEqual([...disposed], [materials[0]]);
    assert.notEqual(
      cache.resolve(keyOf("atlas", new BlockSurface({ alphaMode: "mask", alphaCutoff: 0 }))),
      materials[0]
    );
  });

  it("stops treating a material as idle once a chunk retains it again", () => {
    const cache = makeCache();
    const material = cache.resolve(keyOf("atlas", kBlend));
    cache.retain(material);
    cache.release(material);
    cache.retain(material);

    const disposed: THREE.Material[] = [];
    material.addEventListener("dispose", () => disposed.push(material));
    for (let index = 0; index < 17; index++) {
      const other = cache.resolve(keyOf(
        "atlas",
        new BlockSurface({ alphaMode: "mask", alphaCutoff: index / 100 })
      ));
      cache.retain(other);
      cache.release(other);
    }

    assert.deepEqual(disposed, []);
  });
});
