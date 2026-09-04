// Import Internal Dependencies
import {
  FACE,
  type Vec2,
  type Vec3
} from "../utils/math.ts";
import type { FaceDefinition } from "./BlockShape.ts";

export type ProjectedFaceDefinition =
  & Omit<FaceDefinition, "uvs">
  & Partial<Pick<FaceDefinition, "uvs">>;

export function projectFaceUv(
  face: FACE,
  [x, y, z]: Vec3
): Vec2 {
  switch (face) {
    case FACE.PosX:
      return [z, y];
    case FACE.NegX:
      return [1 - z, y];
    case FACE.PosY:
      return [x, z];
    case FACE.NegY:
      return [x, 1 - z];
    case FACE.PosZ:
      return [x, y];
    default:
      return [1 - x, y];
  }
}

export function faceUvs(
  face: FACE,
  vertices: readonly Vec3[]
): Vec2[] {
  return vertices.map(
    (vertex) => projectFaceUv(face, vertex)
  );
}

export function projectedFace(
  definition: ProjectedFaceDefinition
): FaceDefinition {
  const { uvs, ...rest } = definition;

  return {
    ...rest,
    uvs: uvs ?? faceUvs(definition.face, definition.vertices)
  };
}
