// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type {
  SelectionRect,
  UVTriangleCorner,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export type TexelBounds = readonly [number, number, number, number];
export type HalfPlane = readonly [number, number, number];

export interface UvRegionAttributes {
  region: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  edge: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
}

// CONSTANTS
export const UV_REGION_ATTRIBUTE = "uvRegion";
export const UV_EDGE_ATTRIBUTE = "uvEdge";
const kUnboundedRegion: TexelBounds = [-1e6, -1e6, 1e6, 1e6];
const kNoEdge: HalfPlane = [0, 0, 1];
const kEdgeInsetTexels = 1 / 16;

export function ensureUvRegionAttributes(
  geometry: THREE.BufferGeometry
): UvRegionAttributes {
  const { count } = geometry.getAttribute("uv");

  if (!geometry.hasAttribute(UV_REGION_ATTRIBUTE)) {
    geometry.setAttribute(
      UV_REGION_ATTRIBUTE,
      filledAttribute(kUnboundedRegion, count)
    );
  }
  if (!geometry.hasAttribute(UV_EDGE_ATTRIBUTE)) {
    geometry.setAttribute(
      UV_EDGE_ATTRIBUTE,
      filledAttribute(kNoEdge, count)
    );
  }

  return {
    region: geometry.getAttribute(UV_REGION_ATTRIBUTE),
    edge: geometry.getAttribute(UV_EDGE_ATTRIBUTE)
  };
}

export function texelBounds(
  rect: SelectionRect,
  size: Vec2
): TexelBounds {
  const minX = rect.x + 0.5;
  const minY = size.y - (rect.y + rect.height) + 0.5;

  return [
    minX,
    minY,
    Math.max(minX, rect.x + rect.width - 0.5),
    Math.max(minY, size.y - rect.y - 0.5)
  ];
}

export function diagonalHalfPlane(
  rect: SelectionRect,
  corner: UVTriangleCorner | null,
  size: Vec2
): HalfPlane {
  if (corner === null) {
    return kNoEdge;
  }

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = size.y - rect.y;
  const bottom = top - rect.height;
  const [cornerX, farX] = corner.endsWith("left") ?
    [left, right] :
    [right, left];
  const [cornerY, farY] = corner.startsWith("top") ?
    [top, bottom] :
    [bottom, top];
  const nx = 1 / (farX - cornerX);
  const ny = 1 / (farY - cornerY);
  const length = Math.hypot(nx, ny);
  const offset = (nx * farX) + (ny * cornerY);

  return [
    nx / length,
    ny / length,
    (offset / length) - kEdgeInsetTexels
  ];
}

function filledAttribute(
  fill: readonly number[],
  count: number
): THREE.BufferAttribute {
  const array = new Float32Array(count * fill.length);
  for (let index = 0; index < count; index++) {
    array.set(fill, index * fill.length);
  }

  return new THREE.BufferAttribute(array, fill.length);
}
