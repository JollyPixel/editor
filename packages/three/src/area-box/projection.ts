// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
// Reject angles below about four degrees, where the result diverges.
const kParallelEpsilon = 0.005;

const _delta = new THREE.Vector3();

/**
 * Returns false near parallel without changing `target`.
 */
export function closestPointOnAxis(
  ray: THREE.Ray,
  axisOrigin: THREE.Vector3,
  axisDirection: THREE.Vector3,
  target: THREE.Vector3
): boolean {
  const projection = ray.direction.dot(axisDirection);
  const denominator = 1 - (projection * projection);
  if (denominator < kParallelEpsilon) {
    return false;
  }

  const delta = _delta.subVectors(ray.origin, axisOrigin);
  const alongRay = ray.direction.dot(delta);
  const alongAxis = axisDirection.dot(delta);
  const distance = (alongAxis - (projection * alongRay)) / denominator;

  target
    .copy(axisDirection)
    .multiplyScalar(distance)
    .add(axisOrigin);

  return true;
}
