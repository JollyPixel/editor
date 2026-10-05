// Import Internal Dependencies
import { FACE } from "../../../geometry/faceDirection.ts";
import { SQRT2_OVER_2 } from "./normals.ts";
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
const kRampValleyFaces: readonly FaceDefinition[] = [
  defineFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
  }),
  defineFace({
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
  }),
  defineFace({
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
  }),
  defineFace({
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 0], [0, 1, 1], [0, 1, 0]]
  }),
  defineFace({
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1]]
  }),
  defineFace({
    face: FACE.PosZ,
    normal: [0, -SQRT2_OVER_2, SQRT2_OVER_2],
    vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 1]]
  }),
  defineFace({
    face: FACE.NegX,
    normal: [-SQRT2_OVER_2, -SQRT2_OVER_2, 0],
    vertices: [[1, 0, 0], [1, 0, 1], [0, 1, 1]]
  })
];

export class RampValley extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";
  readonly faces: readonly FaceDefinition[] = kRampValleyFaces;

  constructor(
    id: BlockShapeID = "rampValley"
  ) {
    super();
    this.id = id;
  }
}
