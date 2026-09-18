// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import type { VoxelEngineOptions } from "../src/VoxelEngine.types.ts";
import {
  chunkMeshes,
  makeEngine,
  placeCube
} from "./helpers/engine.ts";

function buildOneChunk(
  options: VoxelEngineOptions = {}
): VoxelEngine {
  const engine = makeEngine({ layers: ["Ground"], ...options });
  placeCube(engine, "Ground", { x: 4, y: 0, z: 0 });
  engine.flush();

  return engine;
}

function render(
  mesh: THREE.Mesh
): void {
  mesh.onAfterRender(
    {} as THREE.WebGLRenderer,
    new THREE.Scene(),
    new THREE.Camera(),
    mesh.geometry,
    mesh.material as THREE.Material,
    new THREE.Group()
  );
}

describe("VoxelEngine - chunk meshes", () => {
  it("raycasts a chunk-local mesh through the shared index", () => {
    const engine = buildOneChunk();
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(4.5, 5, 0.5),
      new THREE.Vector3(0, -1, 0)
    );

    const [hit] = raycaster.intersectObject(engine.root, true);

    assert.equal(hit.point.y, 1);
    assert.deepEqual(hit.normal?.toArray(), [0, 1, 0]);
  });

  it("places each chunk mesh at its chunk origin", () => {
    const engine = makeEngine({ layers: ["Ground"] });
    engine.world.getLayer("Ground")!.position = { x: 1, y: 2, z: 3 };
    placeCube(engine, "Ground", { x: 10, y: 2, z: 3 });
    engine.flush();

    const [mesh] = chunkMeshes(engine);

    assert.deepEqual(mesh.position.toArray(), [9, 2, 3]);
  });

  it("disposes each chunk index on its own", () => {
    const engine = buildOneChunk();
    placeCube(engine, "Ground", { x: 8, y: 0, z: 0 });
    engine.flush();
    const disposed: Array<THREE.BufferAttribute | null> = [];
    const [first, second] = chunkMeshes(engine);
    for (const mesh of [first, second]) {
      mesh.geometry.addEventListener("dispose", () => {
        disposed.push(mesh.geometry.getIndex());
      });
    }
    const firstIndex = first.geometry.getIndex();
    const secondIndex = second.geometry.getIndex();

    engine.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    engine.tick(0);

    assert.deepEqual(disposed, [firstIndex]);
    assert.equal(second.geometry.getIndex(), secondIndex);

    engine.dispose();

    assert.deepEqual(disposed, [firstIndex, secondIndex]);
  });
});

describe("VoxelEngine - shader-only attributes after upload", () => {
  it("drops tileRegion once a chunk has been rendered, and only then", () => {
    const [mesh] = chunkMeshes(buildOneChunk());
    const vertices = mesh.geometry.getAttribute("position").count;
    assert.ok(mesh.geometry.getAttribute("tileRegion").array.length > 0);

    render(mesh);

    assert.equal(mesh.geometry.getAttribute("tileRegion").array.length, 0);
    assert.equal(mesh.geometry.getAttribute("normal").count, vertices);
    assert.equal(mesh.geometry.getAttribute("uv").count, vertices);
  });

  it("keeps every attribute with retainVertexData", () => {
    const [mesh] = chunkMeshes(buildOneChunk({ retainVertexData: true }));
    const length = mesh.geometry.getAttribute("tileRegion").array.length;

    render(mesh);

    assert.equal(mesh.geometry.getAttribute("tileRegion").array.length, length);
  });
});
