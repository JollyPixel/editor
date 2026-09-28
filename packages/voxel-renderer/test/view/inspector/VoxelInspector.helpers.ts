// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelView } from "../../../src/view/VoxelView.ts";
import type { VoxelInspectorOptions } from "../../../src/view/inspector/index.ts";
import {
  makeView,
  placeCube
} from "../../helpers/view.ts";

export interface InspectorEngineOptions {
  inspector?: VoxelInspectorOptions;
  voxels?: number;
}

export function makeInspectorView(
  options: InspectorEngineOptions = {}
): VoxelView {
  const { inspector, voxels = 1 } = options;

  const view = makeView({
    layers: ["Ground"],
    inspector,
    meshing: { budgetMs: 0 }
  });
  for (let x = 0; x < voxels; x++) {
    placeCube(view, "Ground", { x, y: 0, z: 0 });
  }
  view.tick(0);

  return view;
}

export function findGroup(
  view: VoxelView,
  name = "VoxelInspector"
): THREE.Object3D | undefined {
  return view.root.children.find((child) => child.name === name);
}

export function inspectorGroup(
  view: VoxelView,
  name = "VoxelInspector"
): THREE.Object3D {
  const group = findGroup(view, name);
  assert.ok(group, `the ${name} group must be attached to the view root`);

  return group;
}

export function overlayMeshes(
  view: VoxelView
): THREE.Mesh[] {
  return inspectorGroup(view).children.filter(
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
