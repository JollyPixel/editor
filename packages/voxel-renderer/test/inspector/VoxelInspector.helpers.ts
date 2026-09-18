// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelEngine } from "../../src/VoxelEngine.ts";
import type { VoxelInspectorOptions } from "../../src/inspector/index.ts";
import {
  makeEngine,
  placeCube
} from "../helpers/engine.ts";

export interface InspectorEngineOptions {
  inspector?: VoxelInspectorOptions;
  voxels?: number;
}

export function makeInspectorEngine(
  options: InspectorEngineOptions = {}
): VoxelEngine {
  const { inspector, voxels = 1 } = options;

  const engine = makeEngine({
    layers: ["Ground"],
    inspector,
    rebuildBudgetMs: 0
  });
  for (let x = 0; x < voxels; x++) {
    placeCube(engine, "Ground", { x, y: 0, z: 0 });
  }
  engine.tick(0);

  return engine;
}

export function findGroup(
  engine: VoxelEngine,
  name = "VoxelInspector"
): THREE.Object3D | undefined {
  return engine.root.children.find((child) => child.name === name);
}

export function inspectorGroup(
  engine: VoxelEngine,
  name = "VoxelInspector"
): THREE.Object3D {
  const group = findGroup(engine, name);
  assert.ok(group, `the ${name} group must be attached to the engine root`);

  return group;
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
