// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  isOrthographicCamera,
  isPerspectiveCamera
} from "./cameras.ts";

// CONSTANTS
const kMaxPerspectiveFactor = 7;

const _cameraPosition = new THREE.Vector3();

export function screenScaleFactor(
  camera: THREE.Camera,
  worldPosition: THREE.Vector3
): number {
  if (isOrthographicCamera(camera)) {
    const { top, bottom, zoom } = camera;

    return (top - bottom) / zoom;
  }

  _cameraPosition.setFromMatrixPosition(camera.matrixWorld);
  const distance = worldPosition.distanceTo(_cameraPosition);
  if (!isPerspectiveCamera(camera)) {
    return distance;
  }

  const { fov, zoom } = camera;

  return distance * Math.min(
    1.9 * Math.tan((Math.PI * fov) / 360) / zoom,
    kMaxPerspectiveFactor
  );
}
