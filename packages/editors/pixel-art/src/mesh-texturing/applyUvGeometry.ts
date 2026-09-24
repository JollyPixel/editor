// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  rectOf,
  rotateCorner,
  rotateUv,
  rotationOf,
  triangleCornerOf,
  type UVGeometry,
  type UVTriangleCorner,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  diagonalHalfPlane,
  ensureUvRegionAttributes,
  texelBounds
} from "./uvRegion.ts";
import type { FaceVertexRange } from "./types.ts";

export function applyUvGeometry(
  geometry: THREE.BufferGeometry,
  baseUv: Float32Array,
  uvGeometry: UVGeometry,
  textureSize: Vec2,
  ranges: readonly FaceVertexRange[]
): void {
  const rect = rectOf(uvGeometry);
  const rotation = rotationOf(uvGeometry);
  const corner = triangleCornerOf(uvGeometry);
  const orientation = corner === null ?
    null :
    rotateCorner(corner, -rotation);
  const bounds = texelBounds(rect, textureSize);
  const diagonal = diagonalHalfPlane(rect, corner, textureSize);
  const u0 = rect.x / textureSize.x;
  const u1 = (rect.x + rect.width) / textureSize.x;
  const v0 = 1 - ((rect.y + rect.height) / textureSize.y);
  const v1 = 1 - (rect.y / textureSize.y);

  const uvAttribute = geometry.getAttribute("uv");
  const { region, edge } = ensureUvRegionAttributes(geometry);
  for (const range of ranges) {
    const end = range.start + range.count;

    for (let index = range.start; index < end; index++) {
      const baseU = baseUv[index * 2];
      const baseV = baseUv[(index * 2) + 1];
      const [u, v] = rotateUv(
        ...orientUv(baseU, baseV, orientation),
        rotation
      );
      uvAttribute.setXY(
        index,
        u0 + (u * (u1 - u0)),
        v0 + (v * (v1 - v0))
      );
      region.setXYZW(index, ...bounds);
      edge.setXYZ(index, ...diagonal);
    }
  }
  uvAttribute.needsUpdate = true;
  region.needsUpdate = true;
  edge.needsUpdate = true;
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
