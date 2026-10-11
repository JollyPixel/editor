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
import { BlocksetAtlases } from "../../../src/view/atlases/index.ts";
import { AtlasAverages } from "../../../src/view/atlases/AtlasAverages.ts";
import {
  makeAtlasDef,
  registerAtlas
} from "../../helpers/atlas.ts";
import {
  mockTexture,
  readableTexture
} from "../../helpers/mockTexture.ts";

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

  it("renders opaque geometry front-side only, without blending", () => {
    const material = makeCache().resolve(createGeometryKey("atlas"));

    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, !material.transparent);
    assert.equal(material.side, THREE.FrontSide);
  });

  it("shows both sides of cutout geometry even when opaque", () => {
    assert.equal(makeCache().resolve(createGeometryKey("atlas", kBlend)).side, THREE.DoubleSide);
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

describe("ChunkMaterialCache — far materials", () => {
  it("keeps the far variant apart from the near one", () => {
    const cache = makeCache();

    assert.notEqual(
      cache.resolve(createGeometryKey("atlas")),
      cache.resolve(createGeometryKey("atlas"), true)
    );
    assert.equal(
      cache.resolve(createGeometryKey("atlas"), true),
      cache.resolve(createGeometryKey("atlas"), true)
    );
  });

  it("draws far blend surfaces opaque, writing depth", () => {
    const material = makeCache().resolve(createGeometryKey("atlas", kBlend), true);

    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, true);
  });

  it("evicts far variants with their blockset", () => {
    const cache = makeCache();
    const far = cache.resolve(createGeometryKey("atlas"), true);

    cache.invalidate("atlas");

    assert.notEqual(cache.resolve(createGeometryKey("atlas"), true), far);
  });
});

describe("ChunkMaterialCache — alpha to coverage", () => {
  const kMask = new BlockSurface({ alphaMode: "mask" });

  it("is off by default", () => {
    const cache = makeCache();

    assert.equal(cache.alphaToCoverage, false);
    assert.equal(cache.resolve(createGeometryKey("atlas", kMask)).alphaToCoverage, false);
  });

  it("enables it on mask materials only", () => {
    const cache = makeCache({ alphaToCoverage: true });

    assert.equal(cache.resolve(createGeometryKey("atlas", kMask)).alphaToCoverage, true);
    assert.equal(cache.resolve(createGeometryKey("atlas")).alphaToCoverage, false);
    assert.equal(cache.resolve(createGeometryKey("atlas", kBlend)).alphaToCoverage, false);
  });
});

describe("ChunkMaterialCache — vertex pulling", () => {
  it("samples the atlas from its color node only", () => {
    const cache = makeCache();
    const material = cache.resolve(createGeometryKey("atlas"));

    assert.equal(material.map, null);
    assert.ok((material as { colorNode?: unknown; }).colorNode);
  });
});

describe("ChunkMaterialCache — normal texture", () => {
  const kStone = new BlockSurface({ materialGroup: "stone" });

  function reliefCache(
    materialGroups?: MaterialGroupList
  ): ChunkMaterialCache {
    const atlases = new BlocksetAtlases();
    atlases.blocksets.add(makeAtlasDef());
    atlases.registerTexture("atlas", readableTexture(), mockTexture());

    return new ChunkMaterialCache({
      atlases,
      faceTemplates: new FaceTemplateTable(),
      materialGroups
    });
  }

  function normalNodeOf(
    material: THREE.Material
  ): unknown {
    return (material as { normalNode?: unknown; }).normalNode ?? null;
  }

  it("perturbs the normal of a blockset with a normal texture", () => {
    assert.notEqual(normalNodeOf(reliefCache().resolve(createGeometryKey("atlas"))), null);
  });

  it("keeps the geometric normal without a normal texture", () => {
    assert.equal(normalNodeOf(makeCache().resolve(createGeometryKey("atlas"))), null);
  });

  it("keeps the geometric normal on flat distant faces", () => {
    const material = reliefCache().resolve(createGeometryKey("atlas"), true);

    assert.equal(normalNodeOf(material), null);
  });

  it("keeps the geometric normal of a group with a zero normal scale", () => {
    const materialGroups = new MaterialGroupList([
      { id: "stone", normalScale: 0 }
    ]);

    assert.equal(
      normalNodeOf(reliefCache(materialGroups).resolve(createGeometryKey("atlas", kStone))),
      null
    );
  });

  it("updates a non-zero normal scale in place", () => {
    const materialGroups = new MaterialGroupList([{ id: "stone" }]);
    const cache = reliefCache(materialGroups);
    const stone = cache.resolve(createGeometryKey("atlas", kStone));

    materialGroups.define({ id: "stone", normalScale: 2 });

    assert.equal(cache.refreshGroup("stone"), false);
    assert.equal(cache.resolve(createGeometryKey("atlas", kStone)), stone);
    assert.deepEqual(stone.normalScale.toArray(), [2, 2]);
  });

  it("evicts the group materials when the normal scale reaches or leaves zero", () => {
    const materialGroups = new MaterialGroupList([{ id: "stone" }]);
    const cache = reliefCache(materialGroups);
    const relief = cache.resolve(createGeometryKey("atlas", kStone));

    materialGroups.define({ id: "stone", normalScale: 0 });
    assert.equal(cache.refreshGroup("stone"), true);
    const flat = cache.resolve(createGeometryKey("atlas", kStone));
    assert.notEqual(flat, relief);
    assert.equal(normalNodeOf(flat), null);

    materialGroups.define({ id: "stone", normalScale: 1 });
    assert.equal(cache.refreshGroup("stone"), true);
    assert.notEqual(normalNodeOf(cache.resolve(createGeometryKey("atlas", kStone))), null);
  });
});

describe("ChunkMaterialCache — release", () => {
  it("keeps a released material for the next chunk resolving its key", () => {
    const cache = makeCache();
    const material = cache.resolve(createGeometryKey("atlas", kBlend));
    let disposed = false;
    material.addEventListener("dispose", () => {
      disposed = true;
    });

    cache.retain(material);
    cache.release(material);

    assert.equal(disposed, false);
    assert.equal(cache.resolve(createGeometryKey("atlas", kBlend)), material);
  });

  it("disposes the oldest released material past sixteen idle ones", () => {
    const cache = makeCache();
    const materials = Array.from({ length: 17 }, (_, index) => {
      const material = cache.resolve(createGeometryKey(
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
      cache.resolve(createGeometryKey("atlas", new BlockSurface({ alphaMode: "mask", alphaCutoff: 0 }))),
      materials[0]
    );
  });

  it("stops treating a material as idle once a chunk retains it again", () => {
    const cache = makeCache();
    const material = cache.resolve(createGeometryKey("atlas", kBlend));
    cache.retain(material);
    cache.release(material);
    cache.retain(material);

    const disposed: THREE.Material[] = [];
    material.addEventListener("dispose", () => disposed.push(material));
    for (let index = 0; index < 17; index++) {
      const other = cache.resolve(createGeometryKey(
        "atlas",
        new BlockSurface({ alphaMode: "mask", alphaCutoff: index / 100 })
      ));
      cache.retain(other);
      cache.release(other);
    }

    assert.deepEqual(disposed, []);
  });
});
