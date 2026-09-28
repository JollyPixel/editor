// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  VoxelEngine,
  VoxelEngineOptions
} from "../src/VoxelEngine.ts";
import {
  PulledChunkGeometry,
  PulledChunkMesh
} from "../src/mesh/index.ts";
import {
  chunkMeshes,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";
import { makeFakeCollider } from "./helpers/fakes.ts";
import { CHUNK_SIZE } from "./helpers/ids.ts";
import { overlayMeshes } from "./inspector/VoxelInspector.helpers.ts";

function makePulledEngine(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeEngine({
    layers: ["Ground"],
    meshing: { budgetMs: 0 },
    ...options
  });
  placeCube(engine, "Ground", { x: 1, y: 0, z: 1 });
  placeCube(engine, "Ground", { x: 2, y: 0, z: 1 });
  engine.flush();

  return engine;
}

function positionNodeOf(
  mesh: THREE.Mesh
): unknown {
  return (mesh.material as { positionNode?: unknown; }).positionNode ?? null;
}

describe("VoxelEngine - pulled chunk meshes", () => {
  it("draws every chunk as a pulled mesh whose material pulls the vertices", () => {
    const engine = makePulledEngine();
    const meshes = chunkMeshes(engine);

    assert.ok(meshes.length > 0);
    for (const mesh of meshes) {
      assert.ok(mesh instanceof PulledChunkMesh);
      assert.ok(positionNodeOf(mesh) !== null);
    }
  });

  it("hands colliders indexed positions relative to the chunk origin", () => {
    const fake = makeFakeCollider();
    const engine = makePulledEngine({ collider: () => fake.collider });

    const [[, collision]] = fake.rebuilt;
    const [geometry] = collision.geometries.values();
    const bounds = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as THREE.BufferAttribute
    );
    assert.equal(geometry instanceof PulledChunkGeometry, false);
    assert.equal(geometry.getIndex()!.count, 10 * 6);
    assert.deepEqual(bounds.min.toArray(), [1, 0, 1]);
    assert.deepEqual(bounds.max.toArray(), [3, 1, 2]);
    engine.dispose();
  });

  it("wires overlays to an expanded copy it disposes with the overlay", () => {
    const engine = makePulledEngine({ inspector: { mode: "overlay" } });
    const [mesh] = chunkMeshes(engine);
    const [overlay] = overlayMeshes(engine);
    let disposed = false;
    overlay.geometry.addEventListener("dispose", () => {
      disposed = true;
    });

    assert.notEqual(overlay.geometry, mesh.geometry);
    assert.equal(overlay.geometry.getIndex()!.count, 10 * 6);

    engine.inspector.mode = "off";
    assert.equal(disposed, true);
  });

  it("shares one face template table and material across chunks", () => {
    const engine = makePulledEngine();
    placeCube(engine, "Ground", { x: 3 * CHUNK_SIZE, y: 0, z: 0 });
    engine.flush();

    const [near, far] = [...chunkMeshes(engine)]
      .sort((a, b) => a.position.x - b.position.x);
    assert.ok(near.geometry instanceof PulledChunkGeometry);
    assert.ok(far.geometry instanceof PulledChunkGeometry);
    assert.notEqual(near.geometry, far.geometry);
    assert.equal(near.geometry.templates, far.geometry.templates);
    assert.equal(near.material, far.material);
  });
});
