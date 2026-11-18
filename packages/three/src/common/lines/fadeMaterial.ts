// Import Third-party Dependencies
import type * as THREE from "three";

export function fadeMaterial(
  material: THREE.Material,
  opacity: number
): void {
  const transparent = opacity < 1;
  material.opacity = opacity;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
}
