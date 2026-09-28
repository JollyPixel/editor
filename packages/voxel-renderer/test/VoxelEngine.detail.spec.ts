// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  VoxelEngine,
  VoxelEngineOptions
} from "../src/VoxelEngine.ts";
import { makeBlockDef } from "./helpers/blocks.ts";
import {
  chunkMeshes,
  fillChunks,
  makeEngine
} from "./helpers/engine.ts";
import {
  CHUNK_SIZE as kChunkSize,
  CUBE_ID as kCubeId,
  LEAVES_ID as kLeavesId
} from "./helpers/ids.ts";

// CONSTANTS
const kLayer = "Ground";
const kNear = { x: 2, y: 2, z: 2 };
const kLastChunkX = 3 * kChunkSize;

function makeDetailEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeEngine({
    layers: [kLayer],
    meshing: { budgetMs: 0 },
    blocks: [
      makeBlockDef(kCubeId, "cube"),
      makeBlockDef(kLeavesId, "cube", { alphaMode: "blend" })
    ],
    ...options
  });
  fillChunks(engine, kLayer, 4);
  engine.focus = kNear;

  return engine;
}

function meshAt(
  engine: VoxelEngine,
  x: number
): THREE.Mesh {
  const mesh = chunkMeshes(engine).find((candidate) => candidate.position.x === x);
  assert.ok(mesh, `a chunk mesh must sit at x=${x}`);

  return mesh;
}

describe("VoxelEngine - far materials", () => {
  it("draws every chunk with the same materials without a far distance", () => {
    const engine = makeDetailEngine();
    engine.flush();

    assert.equal(meshAt(engine, 0).material, meshAt(engine, kLastChunkX).material);
  });

  it("gives chunks beyond farDistance a material of their own", () => {
    const engine = makeDetailEngine({ range: { farDistance: 1.5 } });
    engine.flush();

    assert.equal(meshAt(engine, 0).material, meshAt(engine, kChunkSize).material);
    assert.notEqual(meshAt(engine, 0).material, meshAt(engine, kLastChunkX).material);
  });

  it("draws far blend blocks opaque", () => {
    const engine = makeDetailEngine({ range: { farDistance: 1.5 } });
    fillChunks(engine, kLayer, 4, kLeavesId);
    engine.flush();

    const near = meshAt(engine, 0).material as THREE.Material;
    const far = meshAt(engine, kLastChunkX).material as THREE.Material;
    assert.equal(near.transparent, true);
    assert.equal(far.transparent, false);
    assert.equal(far.depthWrite, true);
  });

  it("swaps materials without remeshing when the focus moves", () => {
    const engine = makeDetailEngine({ range: { farDistance: 1.5 } });
    engine.flush();
    const nearMaterial = meshAt(engine, 0).material;
    const farMesh = meshAt(engine, kLastChunkX);

    engine.focus = { x: kLastChunkX + 2, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(meshAt(engine, kLastChunkX), farMesh);
    assert.equal(farMesh.material, nearMaterial);
    assert.notEqual(meshAt(engine, 0).material, nearMaterial);
  });

  it("restores full detail once the far distance is lifted", () => {
    const engine = makeDetailEngine({ range: { farDistance: 1.5 } });
    engine.flush();

    engine.range.farDistance = Infinity;
    engine.tick(0);

    assert.equal(meshAt(engine, 0).material, meshAt(engine, kLastChunkX).material);
  });
});
