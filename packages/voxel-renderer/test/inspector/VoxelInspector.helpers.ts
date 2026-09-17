// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../../src/VoxelEngine.ts";
import type { VoxelInspectorOptions } from "../../src/inspector/index.ts";
import {
  makeEngine as makeBaseEngine,
  CUBE_ID as kCubeId
} from "../helpers/engine.ts";

export interface InspectorEngineOptions {
  inspector?: VoxelInspectorOptions;
  voxels?: number;
}

/**
 * Engine with one tileset registered and, unless voxels is empty, a meshed
 * "Ground" layer.
 */
export function makeInspectorEngine(
  options: InspectorEngineOptions = {}
): VoxelEngine {
  const { inspector, voxels = 1 } = options;

  const engine = makeBaseEngine({
    layers: ["Ground"],
    inspector,
    // Drain the whole queue so a single tick() meshes every chunk.
    rebuildBudgetMs: 0
  });
  for (let x = 0; x < voxels; x++) {
    engine.world.setVoxel("Ground", {
      position: { x, y: 0, z: 0 },
      blockId: kCubeId
    });
  }
  engine.tick(0);

  return engine;
}

export function findInspectorGroup(
  engine: VoxelEngine
): THREE.Object3D | undefined {
  return engine.root.children.find(
    (child) => child.name === "VoxelInspector"
  );
}

export function inspectorGroup(
  engine: VoxelEngine
): THREE.Object3D {
  const group = findInspectorGroup(engine);
  assert.ok(group, "the inspector group must be attached to the engine root");

  return group;
}

export function chunkMeshes(
  engine: VoxelEngine
): THREE.Mesh[] {
  return engine.root.children.filter(
    (child): child is THREE.Mesh => child.name.startsWith("voxel_chunk_")
  );
}

export function overlayMeshes(
  engine: VoxelEngine
): THREE.Mesh[] {
  return inspectorGroup(engine).children.filter(
    (child): child is THREE.Mesh => child instanceof THREE.Mesh
  );
}

export function wireframeMaterial(
  mesh: THREE.Mesh
): THREE.MeshBasicMaterial {
  const { material } = mesh;
  assert.ok(material instanceof THREE.MeshBasicMaterial);

  return material;
}
