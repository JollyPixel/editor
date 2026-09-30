// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { MeshHighlightState } from "#src/index.ts";

export interface StateWithMeshAndGroup {
  state: MeshHighlightState;
  mesh: THREE.Mesh;
  group: THREE.Group;
}

export function createBoxMesh(
  size: [number, number, number] = [1, 1, 1]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(...size));
}

export function createStateWithMeshAndGroup(): StateWithMeshAndGroup {
  const state = new MeshHighlightState();
  const mesh = createBoxMesh();
  const group = new THREE.Group();
  group.add(createBoxMesh());

  state.register("mesh-1", mesh);
  state.register("group-1", group);

  return {
    state,
    mesh,
    group
  };
}
