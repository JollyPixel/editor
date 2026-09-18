// Import Internal Dependencies
import {
  FACE_AXIS,
  type FACE,
  type Vec2,
  type Vec3
} from "../../utils/math.ts";
import { UNIT_TILE_SPAN } from "../../tileset/tileRef.ts";
import type { TileSpan } from "../../tileset/types.ts";

/*
 * CONSTANTS
 * Each projector looks at its face from outside the block, so `u` runs to the
 * viewer's right and `v` upwards. Getting an axis backwards mirrors the tile.
 */
const kFaceProjectors: readonly ((vertex: Vec3) => Vec2)[] = [
  ([, y, z]) => [1 - z, y],
  ([, y, z]) => [z, y],
  ([x, , z]) => [1 - x, z],
  ([x, , z]) => [1 - x, 1 - z],
  ([x, y]) => [x, y],
  ([x, y]) => [1 - x, y]
];
const kFaceUAxis: readonly number[] = [2, 2, 0, 0, 0, 0];
const kFaceVAxis: readonly number[] = [1, 1, 2, 2, 1, 1];
const kEpsilon = 1e-6;

export function projectFaceUv(
  face: FACE,
  vertex: Vec3
): Vec2 {
  return kFaceProjectors[face](vertex);
}

export function faceUvSpan(
  face: FACE,
  normal: Vec3
): Readonly<TileSpan> {
  const depth = Math.abs(normal[FACE_AXIS[face]]);
  if (depth < kEpsilon) {
    return UNIT_TILE_SPAN;
  }

  const slopeU = normal[kFaceUAxis[face]] / depth;
  const slopeV = normal[kFaceVAxis[face]] / depth;
  if (Math.abs(slopeU) > kEpsilon && Math.abs(slopeV) > kEpsilon) {
    return UNIT_TILE_SPAN;
  }

  return {
    u: Math.hypot(1, slopeU),
    v: Math.hypot(1, slopeV)
  };
}

export function faceUvs(
  face: FACE,
  vertices: readonly Vec3[]
): Vec2[] {
  const project = kFaceProjectors[face];

  return vertices.map(project);
}
