// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../src/VoxelEngine.ts";
import {
  makeEngine,
  CUBE_ID as kCubeId
} from "./helpers/engine.ts";

function chunkMeshes(
  engine: VoxelEngine
): THREE.Mesh[] {
  return engine.root.children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
  );
}

function buildOneChunk(): VoxelEngine {
  const engine = makeEngine();
  engine.world.addLayer("Ground");
  engine.world.setVoxel("Ground", {
    position: { x: 4, y: 0, z: 0 },
    blockId: kCubeId
  });
  engine.flush();

  return engine;
}

describe("VoxelEngine — chunk meshes", () => {
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

  it("exposes each owned index to disposal without affecting other chunks", () => {
    const engine = buildOneChunk();
    const [mesh] = chunkMeshes(engine);
    const index = mesh.geometry.getIndex();
    const disposed: Array<THREE.BufferAttribute | null> = [];
    mesh.geometry.addEventListener("dispose", () => {
      disposed.push(mesh.geometry.getIndex());
    });
    engine.world.setVoxel("Ground", {
      position: { x: 8, y: 0, z: 0 },
      blockId: kCubeId
    });
    engine.flush();
    const other = chunkMeshes(engine).find((entry) => entry !== mesh)!;
    const otherIndex = other.geometry.getIndex();
    other.geometry.addEventListener("dispose", () => {
      disposed.push(other.geometry.getIndex());
    });

    assert.notEqual(index, otherIndex);
    assert.equal(index!.array.buffer, otherIndex!.array.buffer);

    engine.world.removeVoxel("Ground", { position: { x: 4, y: 0, z: 0 } });
    engine.tick(0);

    assert.deepEqual(disposed, [index]);
    assert.equal(other.geometry.getIndex(), otherIndex);
    engine.dispose();
    assert.deepEqual(disposed, [index, otherIndex]);
  });
});

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

describe("VoxelEngine — shader-only attributes after upload", () => {
  it("drops tileRegion once a chunk has been rendered", () => {
    const [mesh] = chunkMeshes(buildOneChunk());
    const vertices = mesh.geometry.getAttribute("position").count;

    render(mesh);

    assert.equal(mesh.geometry.getAttribute("tileRegion").array.length, 0);
    assert.equal(mesh.geometry.getAttribute("normal").count, vertices);
    assert.equal(mesh.geometry.getAttribute("uv").count, vertices);
  });

  it("keeps tileRegion until the chunk is rendered", () => {
    const [mesh] = chunkMeshes(buildOneChunk());

    assert.ok(mesh.geometry.getAttribute("tileRegion").array.length > 0);
  });

  it("keeps every attribute with retainVertexData", () => {
    const engine = makeEngine({ retainVertexData: true });
    engine.world.addLayer("Ground");
    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 0, z: 0 },
      blockId: kCubeId
    });
    engine.flush();
    const [mesh] = chunkMeshes(engine);
    const length = mesh.geometry.getAttribute("tileRegion").array.length;

    render(mesh);

    assert.equal(mesh.geometry.getAttribute("tileRegion").array.length, length);
  });
});
