// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export function isVisibleInHierarchy(
  object: THREE.Object3D
): boolean {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    if (!current.visible) {
      return false;
    }
    current = current.parent;
  }

  return true;
}
