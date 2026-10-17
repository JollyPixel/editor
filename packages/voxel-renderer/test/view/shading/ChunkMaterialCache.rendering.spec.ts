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
import { makeAtlasDef, registerAtlas } from "../../helpers/atlas.ts";
import { mockTexture, readableTexture } from "../../helpers/mockTexture.ts";

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

  function readNormalNode(
    material: THREE.Material
  ): unknown {
    return (material as { normalNode?: unknown; }).normalNode ?? null;
  }

  it("perturbs the normal of a blockset with a normal texture", () => {
    assert.notEqual(readNormalNode(reliefCache().resolve(createGeometryKey("atlas"))), null);
  });

  it("keeps the geometric normal without a normal texture", () => {
    assert.equal(readNormalNode(makeCache().resolve(createGeometryKey("atlas"))), null);
  });

  it("keeps the geometric normal on flat distant faces", () => {
    const material = reliefCache().resolve(createGeometryKey("atlas"), true);

    assert.equal(readNormalNode(material), null);
  });

  it("keeps the geometric normal of a group with a zero normal scale", () => {
    const materialGroups = new MaterialGroupList([
      { id: "stone", normalScale: 0 }
    ]);

    assert.equal(
      readNormalNode(reliefCache(materialGroups).resolve(createGeometryKey("atlas", kStone))),
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
    assert.equal(readNormalNode(flat), null);

    materialGroups.define({ id: "stone", normalScale: 1 });
    assert.equal(cache.refreshGroup("stone"), true);
    assert.notEqual(readNormalNode(cache.resolve(createGeometryKey("atlas", kStone))), null);
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
