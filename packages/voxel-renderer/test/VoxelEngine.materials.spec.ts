// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../src/VoxelEngine.types.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import {
  chunkMeshes,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";
import {
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "./helpers/ids.ts";

type ChunkMaterial = THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;

function materialsOf(
  engine: VoxelEngine
): ChunkMaterial[] {
  return chunkMeshes(engine).map((mesh) => mesh.material as ChunkMaterial);
}

function meshedGround(
  layerOptions: { opacity?: number; } = {},
  engineOptions: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeEngine(engineOptions);
  engine.world.addLayer("Ground", layerOptions);
  placeCube(engine, "Ground", { x: 0, y: 0, z: 0 });

  return engine;
}

describe("VoxelEngine - layer opacity on the material", () => {
  it("renders a fully opaque layer with an opaque front-sided material", () => {
    const engine = meshedGround();
    engine.flush();

    const [material] = materialsOf(engine);
    assert.equal(material.transparent, false);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    assert.equal(material.side, THREE.FrontSide);
  });

  it("carries the layer opacity on a blended front-sided material", () => {
    const engine = meshedGround({ opacity: 0.5 });
    engine.flush();

    const [material] = materialsOf(engine);
    assert.equal(material.transparent, true);
    assert.equal(material.opacity, 0.5);
    assert.equal(material.depthWrite, false);
    assert.equal(material.side, THREE.FrontSide);
  });

  it("keeps an almost-opaque layer out of the opaque material bucket", () => {
    const engine = meshedGround({ opacity: 0.999 });
    engine.flush();

    const [material] = materialsOf(engine);
    assert.equal(material.transparent, true);
    assert.ok(material.opacity < 1);
  });

  it("gives transparent blocks their own double-sided mesh on an opaque layer", () => {
    const engine = meshedGround({}, {
      blocks: [
        makeBlockDef(kCubeId, "cube"),
        makeBlockDef(kLeavesId, "cube", { alphaMode: "blend" })
      ]
    });
    placeCube(engine, "Ground", { x: 2, y: 0, z: 0 }, kLeavesId);
    engine.flush();

    const meshes = chunkMeshes(engine);
    const solid = meshes.find((mesh) => !mesh.name.endsWith(":cutout"));
    const cutout = meshes.find((mesh) => mesh.name.endsWith(":cutout"));
    assert.equal(meshes.length, 2);
    assert.ok(solid && cutout);

    const solidMaterial = solid.material as ChunkMaterial;
    const cutoutMaterial = cutout.material as ChunkMaterial;
    assert.equal(solidMaterial.map, cutoutMaterial.map);
    assert.equal(solidMaterial.transparent, false);
    assert.equal(cutoutMaterial.transparent, true);
    assert.equal(cutoutMaterial.depthWrite, false);
    assert.equal(solidMaterial.side, THREE.FrontSide);
    assert.equal(cutoutMaterial.side, THREE.DoubleSide);
  });

  it("preserves distinct layer opacities", () => {
    const engine = makeEngine();
    engine.world.addLayer("A", { opacity: 0.5 });
    engine.world.addLayer("B", { opacity: 0.5001 });
    placeCube(engine, "A", { x: 0, y: 0, z: 0 });
    placeCube(engine, "B", { x: 8, y: 0, z: 0 });
    engine.flush();

    const [first, second] = materialsOf(engine);
    assert.notEqual(first, second);
    assert.deepEqual([first.opacity, second.opacity].sort(), [0.5, 0.5001]);
  });
});

describe("VoxelEngine - material groups", () => {
  const kGoldId = 5;

  function goldEngine(
    groups: Array<string | undefined>
  ): VoxelEngine {
    const engine = meshedGround({}, {
      material: "standard",
      blocks: [
        makeBlockDef(kCubeId, "cube"),
        makeBlockDef(kGoldId, "cube", { materialGroup: groups[1] })
      ],
      materialCustomizer(material, _tilesetId, surface) {
        if (
          material instanceof THREE.MeshStandardMaterial &&
          surface.materialGroup === "gold"
        ) {
          material.metalness = 1;
        }
      }
    });
    placeCube(engine, "Ground", { x: 2, y: 0, z: 0 }, kGoldId);
    engine.flush();

    return engine;
  }

  it("gives a grouped block its own customizable material on one atlas", () => {
    const engine = goldEngine([undefined, "gold"]);

    const materials = materialsOf(engine) as THREE.MeshStandardMaterial[];
    assert.equal(materials.length, 2);
    assert.deepEqual(
      materials.map((material) => material.metalness).sort(),
      [0, 1]
    );
    assert.equal(materials[0].map, materials[1].map);
  });

  it("shares one material between ungrouped blocks", () => {
    const engine = goldEngine([undefined, undefined]);

    assert.equal(materialsOf(engine).length, 1);
  });
});
