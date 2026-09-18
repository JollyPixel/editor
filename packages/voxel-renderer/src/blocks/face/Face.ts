// Import Internal Dependencies
import type {
  FACE,
  Vec2,
  Vec3
} from "../../utils/math.ts";
import { defaultCullFace } from "./faceCulling.ts";
import {
  faceUvs,
  faceUvSpan
} from "./faceUv.ts";
import { UNIT_TILE_SPAN } from "../../tileset/tileRef.ts";
import type { TileSpan } from "../../tileset/types.ts";

export interface FaceDescriptor {
  face: FACE;
  normal: Vec3;
  vertices: readonly Vec3[];
  uvs?: readonly Vec2[];
  cull?: FACE | null;
  /**
   * Pins the polygon to a named texture slot instead of letting the supporting
   * plane derive one. Polygons sharing a slot share a tile.
   */
  slot?: string;
}

export interface FaceDefinition {
  readonly face: FACE;
  readonly normal: Vec3;
  readonly vertices: readonly Vec3[];
  readonly uvs: readonly Vec2[];
  readonly cull: FACE | null;
  /**
   * Texture slot the polygon belongs to, or null to derive one from its
   * supporting plane.
   */
  readonly slot?: string | null;
  readonly span?: Readonly<TileSpan>;
}

export function defineFace(
  descriptor: FaceDescriptor
): FaceDefinition {
  const {
    face,
    normal,
    vertices,
    uvs,
    cull,
    slot
  } = descriptor;

  return {
    face,
    normal,
    vertices,
    uvs: uvs ?? faceUvs(face, vertices),
    cull: cull === undefined ? defaultCullFace(descriptor) : cull,
    slot: slot ?? null,
    span: uvs ? UNIT_TILE_SPAN : faceUvSpan(face, normal)
  };
}
