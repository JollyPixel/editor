// Import Internal Dependencies
import type {
  FACE,
  Vec2,
  Vec3
} from "../../utils/math.ts";
import { defaultCullFace } from "./faceCulling.ts";
import { faceUvs } from "./faceUv.ts";

export interface FaceDescriptor {
  face: FACE;
  normal: Vec3;
  vertices: readonly Vec3[];
  uvs?: readonly Vec2[];
  cull?: FACE | null;
}

export interface FaceDefinition {
  readonly face: FACE;
  readonly normal: Vec3;
  readonly vertices: readonly Vec3[];
  readonly uvs: readonly Vec2[];
  readonly cull: FACE | null;
}

export function defineFace(
  descriptor: FaceDescriptor
): FaceDefinition {
  const {
    face,
    normal,
    vertices,
    uvs,
    cull
  } = descriptor;

  return {
    face,
    normal,
    vertices,
    uvs: uvs ?? faceUvs(face, vertices),
    cull: cull === undefined ? defaultCullFace(descriptor) : cull
  };
}
