// Import Internal Dependencies
import type {
  FACE,
  Vec2,
  Vec3
} from "../../utils/math.ts";

// CONSTANTS
const kFaceProjectors: readonly ((vertex: Vec3) => Vec2)[] = [
  ([, y, z]) => [z, y],
  ([, y, z]) => [1 - z, y],
  ([x, , z]) => [x, z],
  ([x, , z]) => [x, 1 - z],
  ([x, y]) => [x, y],
  ([x, y]) => [1 - x, y]
];

export function projectFaceUv(
  face: FACE,
  vertex: Vec3
): Vec2 {
  return kFaceProjectors[face](vertex);
}

export function faceUvs(
  face: FACE,
  vertices: readonly Vec3[]
): Vec2[] {
  const project = kFaceProjectors[face];

  return vertices.map(project);
}
