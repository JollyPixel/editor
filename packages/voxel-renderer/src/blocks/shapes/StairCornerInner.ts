// Import Internal Dependencies
import type {
  BlockShape,
  BlockCollisionHint,
  BlockShapeID,
  FaceDefinition
} from "../BlockShape.ts";
import {
  FACE
} from "../../utils/math.ts";

// CONSTANTS
const kStairCornerInnerFaces: readonly FaceDefinition[] = [
  {
    face: FACE.NegY,
    normal: [0, -1, 0],
    vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
  },
  {
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
  },
  {
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
    uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
  },
  {
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0], [1, 0.5, 0]],
    uvs: [[1, 0], [0, 0], [0, 0.5], [1, 0.5]]
  },
  {
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 1], [0, 0.5, 1], [0, 0.5, 0], [0, 0, 0]],
    uvs: [[1, 0], [1, 0.5], [0, 0.5], [0, 0]]
  },
  {
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 0.5, 0], [0, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0]],
    uvs: [[0, 0], [0, 0.5], [0.5, 0.5], [0.5, 0]]
  },
  {
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0.5], [0, 1, 1], [1, 1, 1], [1, 1, 0.5]],
    uvs: [[0, 0.5], [0, 1], [1, 1], [1, 0.5]]
  },
  {
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0.5, 1, 0], [0.5, 1, 0.5], [1, 1, 0.5], [1, 1, 0]],
    uvs: [[0.5, 0], [0.5, 0.5], [1, 0.5], [1, 0]]
  },
  {
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[0.5, 0.5, 0.5], [0, 0.5, 0.5], [0, 1, 0.5], [0.5, 1, 0.5]],
    uvs: [[0.5, 0], [0, 0], [0, 0.5], [0.5, 0.5]]
  },
  {
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0.5, 0], [0.5, 0.5, 0], [0.5, 1, 0], [1, 1, 0]],
    uvs: [[0.5, 0], [0, 0], [0, 0.5], [0.5, 0.5]]
  },
  {
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0.5, 0.5, 0], [0.5, 0.5, 0.5], [0.5, 1, 0.5], [0.5, 1, 0]],
    uvs: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]
  },
  {
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0.5, 1], [0, 1, 1], [0, 1, 0.5], [0, 0.5, 0.5]],
    uvs: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]
  }
];

/**
 * Concave stair corner that occludes NegY, PosZ, and PosX.
 */
export class StairCornerInner implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairCornerInner"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairCornerInnerFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ || face === FACE.PosX;
  }
}
