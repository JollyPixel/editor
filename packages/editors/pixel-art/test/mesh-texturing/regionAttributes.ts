// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  UV_EDGE_ATTRIBUTE,
  UV_REGION_ATTRIBUTE
} from "#src/mesh-texturing/uvRegion.ts";

export function readRegion(
  geometry: THREE.BufferGeometry,
  index: number
): number[] {
  const attribute = geometry.getAttribute(UV_REGION_ATTRIBUTE);

  return [
    attribute.getX(index),
    attribute.getY(index),
    attribute.getZ(index),
    attribute.getW(index)
  ];
}

export function readEdge(
  geometry: THREE.BufferGeometry,
  index: number
): number[] {
  const attribute = geometry.getAttribute(UV_EDGE_ATTRIBUTE);

  return [attribute.getX(index), attribute.getY(index), attribute.getZ(index)];
}
