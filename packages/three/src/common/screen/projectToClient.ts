// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kNdc = new THREE.Vector3();

export interface ClientTarget {
  getBoundingClientRect(): Pick<
    DOMRectReadOnly,
    "left" | "top" | "width" | "height"
  >;
}

export function projectToClient(
  camera: THREE.Camera,
  canvas: ClientTarget,
  point: THREE.Vector3Like
): THREE.Vector2Like | null {
  camera.updateMatrixWorld();
  kNdc.copy(point).project(camera);
  if (kNdc.z < -1 || kNdc.z > 1) {
    return null;
  }

  const bounds = canvas.getBoundingClientRect();

  return {
    x: bounds.left + (((kNdc.x + 1) / 2) * bounds.width),
    y: bounds.top + (((1 - kNdc.y) / 2) * bounds.height)
  };
}
