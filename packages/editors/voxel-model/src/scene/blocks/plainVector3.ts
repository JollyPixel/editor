// Import Third-party Dependencies
import type * as THREE from "three";

export function plainVector3(
  value: THREE.Vector3Like
): THREE.Vector3Like {
  return {
    x: value.x,
    y: value.y,
    z: value.z
  };
}
