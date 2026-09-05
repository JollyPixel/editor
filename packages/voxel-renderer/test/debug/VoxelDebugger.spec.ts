// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelEngine } from "../../src/VoxelEngine.ts";
import type { VoxelDebuggerOptions } from "../../src/debug/VoxelDebugger.ts";
import {
  makeEngine as makeBaseEngine,
  CUBE_ID as kCubeId
} from "../helpers/engine.ts";

/**
 * Engine with one tileset registered and, unless `voxels` is empty, a meshed
 * "Ground" layer.
 */
function makeEngine(
  options: { debug?: VoxelDebuggerOptions; voxels?: number; } = {}
): VoxelEngine {
  const { debug, voxels = 1 } = options;

  const engine = makeBaseEngine({ layers: ["Ground"], debug });

  for (let x = 0; x < voxels; x++) {
    engine.world.setVoxel("Ground", {
      position: { x, y: 0, z: 0 },
      blockId: kCubeId
    });
  }
  engine.tick(0);

  return engine;
}

function findDebugGroup(
  engine: VoxelEngine
): THREE.Object3D | undefined {
  return engine.root.children.find(
    (child) => child.name === "VoxelDebugger"
  );
}

function debugGroup(
  engine: VoxelEngine
): THREE.Object3D {
  const group = findDebugGroup(engine);
  assert.ok(group, "the debug group must be attached to the engine root");

  return group;
}

function chunkMeshes(
  engine: VoxelEngine
): THREE.Mesh[] {
  return engine.root.children.filter(
    (child): child is THREE.Mesh => child.name.startsWith("voxel_chunk_")
  );
}

function overlayMeshes(
  engine: VoxelEngine
): THREE.Mesh[] {
  return debugGroup(engine).children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
  );
}

function wireframeMaterial(
  mesh: THREE.Mesh
): THREE.MeshBasicMaterial {
  const { material } = mesh;
  assert.ok(material instanceof THREE.MeshBasicMaterial);

  return material;
}

describe("VoxelDebugger — statistics", () => {
  it("reports nothing before any chunk is meshed", () => {
    const engine = new VoxelEngine({
      chunkSize: 4,
      layers: ["Ground"]
    });

    assert.deepEqual(engine.debug.stats, {
      chunks: 0,
      culledChunks: 0,
      meshes: 0,
      voxels: 0,
      hiddenVoxels: 0,
      faces: 0,
      culledFaces: 0,
      mergedFaces: 0,
      vertices: 0,
      triangles: 0,
      facesPerSolidVoxel: 0,
      bytesPerVertex: 0,
      buildTimeMs: 0
    });
  });

  it("aggregates the geometry of a single meshed cube", () => {
    const engine = makeEngine();
    const stats = engine.debug.stats;

    assert.equal(stats.chunks, 1);
    assert.equal(stats.meshes, 1);
    assert.equal(stats.voxels, 1);
    assert.equal(stats.faces, 6);
    assert.equal(stats.culledFaces, 0);
    assert.equal(stats.vertices, 24);
    assert.equal(stats.triangles, 12);
  });

  it("counts the faces culled between two adjacent cubes", () => {
    const engine = makeEngine({ voxels: 2 });
    const stats = engine.debug.stats;

    assert.equal(stats.voxels, 2);
    assert.equal(stats.faces, 10);
    assert.equal(stats.culledFaces, 2);
  });

  it("drops the statistics of a chunk once its layer is removed", () => {
    const engine = makeEngine();
    engine.world.removeLayer("Ground");
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 0);
    assert.equal(engine.debug.stats.faces, 0);
  });

  it("does not double-count a chunk rebuilt several times", () => {
    const engine = makeEngine();
    engine.markAllChunksDirty("test");
    engine.tick(0);

    assert.equal(engine.debug.stats.chunks, 1);
    assert.equal(engine.debug.stats.faces, 6);
  });
});

describe("VoxelDebugger — modes", () => {
  it("is off by default and leaves nothing in the scene graph", () => {
    const engine = makeEngine();

    assert.equal(engine.debug.mode, "off");
    assert.equal(engine.debug.enabled, false);
    assert.equal(findDebugGroup(engine), undefined);
  });

  it("adds one wireframe per chunk mesh in overlay mode, sharing its geometry", () => {
    const engine = makeEngine();
    engine.debug.mode = "overlay";

    const [mesh] = chunkMeshes(engine);
    const overlays = overlayMeshes(engine);

    assert.equal(overlays.length, 1);
    assert.equal(mesh.visible, true);
    assert.equal(overlays[0].geometry, mesh.geometry);
    assert.ok(
      wireframeMaterial(overlays[0]).wireframe
    );
  });

  it("hides the textured meshes in wireframe mode and restores them when off", () => {
    const engine = makeEngine();

    engine.debug.mode = "wireframe";
    assert.equal(chunkMeshes(engine)[0].visible, false);
    assert.equal(debugGroup(engine).children.length, 1);

    engine.debug.mode = "off";
    assert.equal(chunkMeshes(engine)[0].visible, true);
    assert.equal(findDebugGroup(engine), undefined);
  });

  it("applies the mode to chunks meshed after it was set", () => {
    const engine = makeEngine();
    engine.debug.mode = "wireframe";

    engine.world.setVoxel("Ground", {
      position: { x: 0, y: 8, z: 0 },
      blockId: kCubeId
    });
    engine.tick(0);

    assert.equal(debugGroup(engine).children.length, 2);
    for (const mesh of chunkMeshes(engine)) {
      assert.equal(mesh.visible, false);
    }
  });

  it("removes the wireframe of a chunk that is rebuilt", () => {
    const engine = makeEngine();
    engine.debug.mode = "overlay";

    engine.markAllChunksDirty("test");
    engine.tick(0);

    const overlays = overlayMeshes(engine);
    assert.equal(overlays.length, 1);
    assert.equal(
      overlays[0].geometry,
      chunkMeshes(engine)[0].geometry
    );
  });

  it("starts in the mode passed through the engine options", () => {
    const engine = makeEngine({
      debug: {
        mode: "overlay",
        color: 0xFF0000,
        opacity: 1
      }
    });

    assert.equal(engine.debug.enabled, true);
    const material = wireframeMaterial(overlayMeshes(engine)[0]);
    assert.equal(material.transparent, false);
    assert.equal(material.color.getHex(), 0xFF0000);
  });

  it("cycles off → overlay → wireframe → off", () => {
    const engine = makeEngine();
    const { debug } = engine;

    assert.equal(debug.nextMode(), "overlay");
    assert.equal(debug.nextMode(), "wireframe");
    assert.equal(debug.nextMode(), "off");

    debug.enabled = true;
    assert.equal(debug.mode, "overlay");
    debug.enabled = false;
    assert.equal(debug.mode, "off");
  });

  it("detaches the wireframe group on dispose", () => {
    const engine = makeEngine({
      debug: { mode: "overlay" }
    });
    engine.dispose();

    assert.equal(findDebugGroup(engine), undefined);
    assert.equal(engine.debug.stats.chunks, 0);
  });
});
