// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { isOrthographicCamera } from "./cameras.ts";

// CONSTANTS
const kCameraPosition = new THREE.Vector3();

export function eyeDirection(
  camera: THREE.Camera,
  worldPosition: THREE.Vector3,
  target: THREE.Vector3
): THREE.Vector3 {
  if (isOrthographicCamera(camera)) {
    return camera.getWorldDirection(target).negate();
  }

  kCameraPosition.setFromMatrixPosition(camera.matrixWorld);

  return target
    .subVectors(kCameraPosition, worldPosition)
    .normalize();
}
