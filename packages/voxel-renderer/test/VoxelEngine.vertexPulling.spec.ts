// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelEngine,
  type VoxelEngineOptions
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
    rebuildBudgetMs: 0,
    vertexPulling: true,
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

describe("VoxelEngine - vertex pulling", () => {
  it("is off by default", () => {
    assert.equal(new VoxelEngine().vertexPulling, false);
  });

  it("draws pulled chunk meshes whose material pulls the vertices", () => {
    const engine = makePulledEngine();
    const meshes = chunkMeshes(engine);

    assert.ok(meshes.length > 0);
    for (const mesh of meshes) {
      assert.ok(mesh instanceof PulledChunkMesh);
      assert.ok(positionNodeOf(mesh) !== null);
    }
  });

  it("switches meshes and materials back and forth at runtime", () => {
    const engine = makePulledEngine();
    const pulled = chunkMeshes(engine)[0].material;

    engine.vertexPulling = false;
    engine.tick(0);
    const [classic] = chunkMeshes(engine);
    assert.equal(engine.vertexPulling, false);
    assert.equal(classic instanceof PulledChunkMesh, false);
    assert.equal(positionNodeOf(classic), null);
    assert.notEqual(classic.material, pulled);

    engine.vertexPulling = true;
    engine.tick(0);
    assert.ok(chunkMeshes(engine)[0] instanceof PulledChunkMesh);
  });

  it("gives way to greedy meshing", () => {
    const engine = makePulledEngine({ greedy: true });

    for (const mesh of chunkMeshes(engine)) {
      assert.equal(mesh instanceof PulledChunkMesh, false);
      assert.equal(positionNodeOf(mesh), null);
    }

    engine.greedy = false;
    engine.tick(0);
    assert.ok(chunkMeshes(engine)[0] instanceof PulledChunkMesh);
  });

  it("raycasts the engine root like classic chunk meshes", () => {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(2.5, 5, 1.5),
      new THREE.Vector3(0, -1, 0)
    );

    const [hit] = ray.intersectObject(makePulledEngine().root, true);

    assert.equal(hit.point.y, 1);
    assert.deepEqual(hit.normal?.toArray(), [0, 1, 0]);
    assert.ok(hit.object instanceof PulledChunkMesh);
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

  it("shares one face template table with coarse chunks", () => {
    const engine = makeEngine({
      layers: ["Ground"],
      rebuildBudgetMs: 0,
      vertexPulling: true,
      lodDistance: 10
    });
    for (const x of [0, 3 * CHUNK_SIZE]) {
      for (let dx = 0; dx < 2; dx++) {
        placeCube(engine, "Ground", { x: x + dx, y: 0, z: 0 });
      }
    }
    engine.focus = { x: 2, y: 2, z: 2 };
    engine.flush();

    const [near, far] = [...chunkMeshes(engine)]
      .sort((a, b) => a.position.x - b.position.x);
    assert.ok(near.geometry instanceof PulledChunkGeometry);
    assert.ok(far.geometry instanceof PulledChunkGeometry);
    assert.equal(far.scale.x, 2);
    assert.equal(near.geometry.templates, far.geometry.templates);
    assert.equal(near.material, far.material);
  });
});
