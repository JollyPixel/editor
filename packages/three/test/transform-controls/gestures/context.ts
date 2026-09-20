// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { GestureContext } from "#src/transform-controls/gestures/GestureContext.ts";
import type { TransformHandle } from "#src/index.ts";

// CONSTANTS
const kCameraDistance = 10;

/*
 * The fixture camera sits on +Z and looks at the origin, so every ray
 * travels along -Z and `rayAt(x, y)` crosses the z = 0 plane at (x, y).
 */
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

export function assertClose(
  actual: number,
  expected: number,
  message?: string
): void {
  if (Math.abs(actual - expected) > 1e-6) {
    throw new Error(
      `${message ?? "value"}: expected ${expected}, received ${actual}`
    );
  }
}
