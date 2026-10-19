// Import Third-party Dependencies
import * as THREE from "three";

export function isOrthographicCamera(
  camera: THREE.Camera
): camera is THREE.OrthographicCamera {
  return "isOrthographicCamera" in camera &&
    camera.isOrthographicCamera === true;
}

export function isPerspectiveCamera(
  camera: THREE.Camera
): camera is THREE.PerspectiveCamera {
  return "isPerspectiveCamera" in camera &&
    camera.isPerspectiveCamera === true;
}
