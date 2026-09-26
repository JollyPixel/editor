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
  makeEngine,
  placeCube
} from "./helpers/engine.ts";
import { makeFakeCollider } from "./helpers/fakes.ts";
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
    rebuildBudgetMs: 0,
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

function vertexCount(
  mesh: THREE.Mesh
): number {
  return mesh.geometry.getAttribute("position").count;
}

describe("VoxelEngine - far materials", () => {
  it("draws every chunk with the same materials without a far distance", () => {
    const engine = makeDetailEngine();
    engine.flush();

    assert.equal(meshAt(engine, 0).material, meshAt(engine, kLastChunkX).material);
  });

  it("gives chunks beyond farDistance a material of their own", () => {
    const engine = makeDetailEngine({ farDistance: 6 });
    engine.flush();

    assert.equal(meshAt(engine, 0).material, meshAt(engine, kChunkSize).material);
    assert.notEqual(meshAt(engine, 0).material, meshAt(engine, kLastChunkX).material);
  });

  it("draws far blend blocks opaque", () => {
    const engine = makeDetailEngine({ farDistance: 6 });
    fillChunks(engine, kLayer, 4, kLeavesId);
    engine.flush();

    const near = meshAt(engine, 0).material as THREE.Material;
    const far = meshAt(engine, kLastChunkX).material as THREE.Material;
    assert.equal(near.transparent, true);
    assert.equal(far.transparent, false);
    assert.equal(far.depthWrite, true);
  });

  it("swaps materials without remeshing when the focus moves", () => {
    const engine = makeDetailEngine({ farDistance: 6 });
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
    const engine = makeDetailEngine({ farDistance: 6 });
    engine.flush();

    engine.farDistance = Infinity;
    engine.tick(0);

    assert.equal(meshAt(engine, 0).material, meshAt(engine, kLastChunkX).material);
  });
});

describe("VoxelEngine - half resolution chunks", () => {
  function fillCell(
    engine: VoxelEngine,
    x: number
  ): void {
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dz = 0; dz < 2; dz++) {
          placeCube(engine, kLayer, { x: x + dx, y: dy, z: dz });
        }
      }
    }
  }

  it("meshes chunks beyond lodDistance as one block per cell, twice as large", () => {
    const engine = makeDetailEngine({ lodDistance: 10 });
    fillCell(engine, 0);
    fillCell(engine, kLastChunkX);
    engine.flush();

    const near = meshAt(engine, 0);
    const far = meshAt(engine, kLastChunkX);
    assert.equal(near.scale.x, 1);
    assert.equal(far.scale.x, 2);
    assert.equal(vertexCount(near), 96);
    assert.equal(vertexCount(far), 24);
  });

  it("remeshes a chunk at full resolution when the focus comes close", () => {
    const engine = makeDetailEngine({ lodDistance: 10 });
    fillCell(engine, kLastChunkX);
    engine.flush();
    assert.equal(meshAt(engine, kLastChunkX).scale.x, 2);

    engine.focus = { x: kLastChunkX + 2, y: 2, z: 2 };
    engine.tick(0);

    const remeshed = meshAt(engine, kLastChunkX);
    assert.equal(remeshed.scale.x, 1);
    assert.equal(vertexCount(remeshed), 96);
    assert.equal(meshAt(engine, 0).scale.x, 2);
  });

  it("leaves colliders to full resolution builds", () => {
    const fake = makeFakeCollider();
    const engine = makeDetailEngine({
      lodDistance: 10,
      collider: () => fake.collider
    });
    engine.flush();

    function origins(): number[] {
      return fake.rebuilt.map(([, collision]) => collision.origin.x);
    }
    assert.deepEqual(origins(), [0, kChunkSize, 2 * kChunkSize]);

    engine.focus = { x: kLastChunkX + 2, y: 2, z: 2 };
    engine.tick(0);

    assert.ok(origins().includes(kLastChunkX));
  });

  it("follows greedy meshing on the coarse grid", () => {
    const engine = makeDetailEngine({
      lodDistance: 10,
      greedy: true
    });
    fillCell(engine, kLastChunkX);
    fillCell(engine, kLastChunkX + 2);
    engine.flush();

    const far = meshAt(engine, kLastChunkX);
    assert.equal(far.scale.x, 2);
    assert.equal(vertexCount(far), 24);
    assert.ok(far.geometry.getAttribute("tileRepeat"));
  });
});

describe("VoxelEngine - half resolution borders", () => {
  function fillBorderCells(
    engine: VoxelEngine
  ): void {
    for (const x of [kLastChunkX - 2, kLastChunkX]) {
      for (let dx = 0; dx < 2; dx++) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dz = 0; dz < 2; dz++) {
            placeCube(engine, kLayer, { x: x + dx, y: dy, z: dz });
          }
        }
      }
    }
  }

  it("culls the shared face between two coarse chunks", () => {
    const engine = makeDetailEngine({ lodDistance: 6 });
    fillBorderCells(engine);
    engine.flush();

    assert.equal(meshAt(engine, kLastChunkX - kChunkSize).scale.x, 2);
    assert.equal(vertexCount(meshAt(engine, kLastChunkX)), 20);
  });

  it("keeps the face a coarse chunk shows to a full resolution neighbour", () => {
    const engine = makeDetailEngine({ lodDistance: 10 });
    fillBorderCells(engine);
    engine.flush();

    assert.equal(meshAt(engine, kLastChunkX - kChunkSize).scale.x, 1);
    assert.equal(vertexCount(meshAt(engine, kLastChunkX)), 24);
  });

  it("remeshes a coarse chunk when its neighbour returns to full resolution", () => {
    const engine = makeDetailEngine({ lodDistance: 6 });
    fillBorderCells(engine);
    engine.flush();
    assert.equal(vertexCount(meshAt(engine, kLastChunkX)), 20);

    engine.focus = { x: kLastChunkX - kChunkSize - 2, y: 2, z: 2 };
    engine.tick(0);

    assert.equal(meshAt(engine, kLastChunkX - kChunkSize).scale.x, 1);
    assert.equal(meshAt(engine, kLastChunkX).scale.x, 2);
    assert.equal(vertexCount(meshAt(engine, kLastChunkX)), 24);
  });
});
