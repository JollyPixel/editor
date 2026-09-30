// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightBoxSilhouette } from "#src/index.ts";

export type SilhouettePass = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

export function backPassOf(
  overlay: HighlightBoxSilhouette
): SilhouettePass | undefined {
  return overlay.children.find(
    (child): child is SilhouettePass => (
      child instanceof THREE.Mesh && child.material.depthFunc === THREE.GreaterDepth
    )
  );
}

export function colorAt(
  geometry: THREE.BufferGeometry,
  index: number
): THREE.Color {
  const attribute = geometry.getAttribute("color");

  return new THREE.Color(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
}

export function lastColorOf(
  geometry: THREE.BufferGeometry
): THREE.Color {
  return colorAt(geometry, geometry.getAttribute("position").count - 1);
}
