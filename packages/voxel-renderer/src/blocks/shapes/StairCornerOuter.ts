// Import Internal Dependencies
import type {
  BlockShape,
  BlockCollisionHint,
  BlockShapeID,
  FaceDefinition
} from "../BlockShape.ts";
import { projectedFace } from "../faceUv.ts";
import {
  FACE
} from "../../utils/math.ts";

// CONSTANTS
const kStairCornerOuterFaces: readonly FaceDefinition[] = [
  projectedFace({
    face: FACE.NegY,
    normal: [0, -1, 0],
    vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
  }),
  projectedFace({
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0], [1, 0.5, 0]]
  }),
  projectedFace({
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[0.5, 0.5, 0], [0, 0.5, 0], [0, 1, 0], [0.5, 1, 0]]
  }),
  projectedFace({
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 1], [0, 0.5, 1], [0, 0.5, 0], [0, 0, 0]]
  }),
  projectedFace({
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0.5, 0], [0, 0.5, 0.5], [0, 1, 0.5], [0, 1, 0]]
  }),
  projectedFace({
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[0, 0, 1], [1, 0, 1], [1, 0.5, 1], [0, 0.5, 1]]
  }),
  projectedFace({
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]]
  }),
  projectedFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0], [0, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, 0]]
  }),
  projectedFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0.5, 0.5, 0], [0.5, 0.5, 0.5], [1, 0.5, 0.5], [1, 0.5, 0]]
  }),
  projectedFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 0.5, 0.5], [0, 0.5, 1], [0.5, 0.5, 1], [0.5, 0.5, 0.5]]
  }),
  projectedFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0.5, 0.5, 0.5], [0.5, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0.5]]
  }),
  projectedFace({
    face: FACE.PosX,
    cull: null,
    normal: [1, 0, 0],
    vertices: [[0.5, 0.5, 0.5], [0.5, 0.5, 0], [0.5, 1, 0], [0.5, 1, 0.5]]
  }),
  projectedFace({
    face: FACE.PosZ,
    cull: null,
    normal: [0, 0, 1],
    vertices: [[0, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 1, 0.5], [0, 1, 0.5]]
  })
];

/**
 * Convex stair corner whose bottom is its only fully occluding face.
 */
export class StairCornerOuter implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairCornerOuter"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairCornerOuterFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY;
  }
}
