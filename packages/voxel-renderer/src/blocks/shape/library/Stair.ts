// Import Internal Dependencies
import { FACE } from "../../../utils/math.ts";
import {
  defineFace,
  type FaceDefinition
} from "../../face/index.ts";
import { BlockShapeBase } from "../BlockShapeBase.ts";
import type {
  BlockCollisionHint,
  BlockShapeID
} from "../BlockShape.ts";

// CONSTANTS
const kStairFaces: readonly FaceDefinition[] = [
  defineFace({
    face: FACE.NegY,
    normal: [0, -1, 0],
    vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
  }),
  defineFace({
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
  }),
  defineFace({
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0], [1, 0.5, 0]]
  }),
  defineFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 0.5, 0], [0, 0.5, 0.5], [1, 0.5, 0.5], [1, 0.5, 0]]
  }),
  defineFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0.5], [0, 1, 1], [1, 1, 1], [1, 1, 0.5]]
  }),
  defineFace({
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0.5, 0.5], [0, 0.5, 0.5], [0, 1, 0.5], [1, 1, 0.5]]
  }),
  defineFace({
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]]
  }),
  defineFace({
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0.5, 0.5], [1, 1, 0.5], [1, 1, 1], [1, 0.5, 1]]
  }),
  defineFace({
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 1], [0, 0.5, 1], [0, 0.5, 0], [0, 0, 0]]
  }),
  defineFace({
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0.5, 1], [0, 1, 1], [0, 1, 0.5], [0, 0.5, 0.5]]
  })
];

/**
 * Straight stair that occludes NegY and PosZ.
 */
export class Stair extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";
  readonly faces: readonly FaceDefinition[] = kStairFaces;

  constructor(
    id: BlockShapeID = "stair"
  ) {
    super();
    this.id = id;
  }
}
