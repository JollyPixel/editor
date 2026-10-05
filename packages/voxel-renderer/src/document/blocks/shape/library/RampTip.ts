// Import Internal Dependencies
import { FACE } from "../../../geometry/faceDirection.ts";
import { SQRT3_OVER_3 } from "./normals.ts";
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
const kRampTipFaces: readonly FaceDefinition[] = [
  defineFace({
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 0]]
  }),
  defineFace({
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 0], [0, 1, 1], [0, 1, 0]]
  }),
  defineFace({
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0]]
  }),
  defineFace({
    face: FACE.NegY,
    normal: [SQRT3_OVER_3, -SQRT3_OVER_3, SQRT3_OVER_3],
    vertices: [[0, 0, 0], [1, 1, 0], [0, 1, 1]]
  })
];

export class RampTip extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";
  readonly faces: readonly FaceDefinition[] = kRampTipFaces;

  constructor(
    id: BlockShapeID = "rampTip"
  ) {
    super();
    this.id = id;
  }
}
