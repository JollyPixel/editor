// Import Third-party Dependencies
import type * as THREE from "three";
import {
  rotateCorner,
  rotateUv,
  rotationOf,
  type SelectionRect,
  type UVGeometry,
  type UVQuarterTurn,
  type UVTriangleCorner,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { FaceVertexRange } from "./types.ts";

export interface ApplyUvRectOptions {
  uvAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  baseUv: Float32Array;
  rect: SelectionRect;
  textureSize: Vec2;
  ranges: readonly FaceVertexRange[];
  corner?: UVTriangleCorner | null;
  rotation?: UVQuarterTurn;
}

export function applyUvGeometry(
  uvAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  baseUv: Float32Array,
  geometry: UVGeometry,
  textureSize: Vec2,
  ranges: readonly FaceVertexRange[]
): void {
  const rect = "shape" in geometry ? geometry.rect : geometry;
  const rotation = rotationOf(geometry);
  const corner = "shape" in geometry && geometry.shape === "triangle" ?
    rotateCorner(geometry.corner, -rotation) :
    null;

  applyUvRect({
    uvAttribute,
    baseUv,
    rect,
    textureSize,
    ranges,
    corner,
    rotation
  });
}

export function applyUvRect(
  options: ApplyUvRectOptions
): void {
  const {
    uvAttribute,
    baseUv,
    rect,
    textureSize,
    ranges,
    corner = null,
    rotation = 0
  } = options;
  const u0 = rect.x / textureSize.x;
  const u1 = (rect.x + rect.width) / textureSize.x;
  const v0 = 1 - ((rect.y + rect.height) / textureSize.y);
  const v1 = 1 - (rect.y / textureSize.y);

  for (const range of ranges) {
    const end = range.start + range.count;

    for (let index = range.start; index < end; index++) {
      const baseU = baseUv[index * 2];
      const baseV = baseUv[(index * 2) + 1];
      const [u, v] = rotateUv(
        ...orientUv(baseU, baseV, corner),
        rotation
      );
      uvAttribute.setXY(
        index,
        u0 + (u * (u1 - u0)),
        v0 + (v * (v1 - v0))
      );
    }
  }
}

export function orientUv(
  u: number,
  v: number,
  corner: UVTriangleCorner | null
): [number, number] {
  return [
    corner?.endsWith("left") ? 1 - u : u,
    corner?.startsWith("top") ? 1 - v : v
  ];
}
