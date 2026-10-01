// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { GestureContext } from "#src/transform-controls/gestures/GestureContext.ts";
import type { TransformHandle } from "#src/index.ts";

// CONSTANTS
const kCameraDistance = 10;

export function rayAt(
  x: number,
  y: number
): THREE.Ray {
  return new THREE.Ray(
    new THREE.Vector3(x, y, kCameraDistance),
    new THREE.Vector3(0, 0, -1)
  );
}

export function createContext(
  handle: TransformHandle,
  ray: THREE.Ray,
  overrides: Partial<GestureContext> = {}
): GestureContext {
  return {
    handle,
    ray,
    origin: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    eye: new THREE.Vector3(0, 0, 1),
    cameraQuaternion: new THREE.Quaternion(),
    size: 1,
    ...overrides
  };
}
