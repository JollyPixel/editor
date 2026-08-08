// Import Third-party Dependencies
import type * as THREE from "three";
import type {
  SelectionRect,
  UVGeometry,
  UVTriangleCorner,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { FaceVertexRange } from "./PreviewShape.ts";

export interface ApplyUvRectOptions {
  uvAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  baseUv: Float32Array;
  rect: SelectionRect;
  textureSize: Vec2;
  range: FaceVertexRange;
  corner?: UVTriangleCorner | null;
}

export function applyUvGeometry(
  uvAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  baseUv: Float32Array,
  geometry: UVGeometry,
  textureSize: Vec2,
  range: FaceVertexRange
): void {
  const triangle = "shape" in geometry ? geometry : null;
  const rect = "shape" in geometry ? geometry.rect : geometry;

  applyUvRect({
    uvAttribute,
    baseUv,
    rect,
    textureSize,
    range,
    corner: triangle?.corner
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
    range,
    corner = null
  } = options;
  const u0 = rect.x / textureSize.x;
  const u1 = (rect.x + rect.width) / textureSize.x;
  const v0 = 1 - ((rect.y + rect.height) / textureSize.y);
  const v1 = 1 - (rect.y / textureSize.y);
  const end = range.start + range.count;

  for (let index = range.start; index < end; index++) {
    const baseU = baseUv[index * 2];
    const baseV = baseUv[(index * 2) + 1];
    const [u, v] = orientUv(baseU, baseV, corner);
    uvAttribute.setXY(index, u === 0 ? u0 : u1, v === 0 ? v0 : v1);
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
