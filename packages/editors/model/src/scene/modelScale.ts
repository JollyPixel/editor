// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export function modelScale(
  bounds: THREE.Box3
): number {
  if (bounds.isEmpty()) {
    return 1;
  }

  const { radius } = bounds.getBoundingSphere(new THREE.Sphere());

  return radius > 0 ? radius : 1;
}
