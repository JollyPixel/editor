// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../../src/VoxelEngine.ts";
import type { VoxelDebuggerOptions } from "../../src/debug/index.ts";
import {
  makeEngine as makeBaseEngine,
  CUBE_ID as kCubeId
} from "../helpers/engine.ts";

export interface DebugEngineOptions {
  debug?: VoxelDebuggerOptions;
  voxels?: number;
}

/**
 * Engine with one tileset registered and, unless voxels is empty, a meshed
 * "Ground" layer.
 */
export function makeDebugEngine(
  options: DebugEngineOptions = {}
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

export function findDebugGroup(
  engine: VoxelEngine
): THREE.Object3D | undefined {
  return engine.root.children.find(
    (child) => child.name === "VoxelDebugger"
  );
}

export function debugGroup(
  engine: VoxelEngine
): THREE.Object3D {
  const group = findDebugGroup(engine);
  assert.ok(group, "the debug group must be attached to the engine root");

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
  return debugGroup(engine).children.filter(
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
