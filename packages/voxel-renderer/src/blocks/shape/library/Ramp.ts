// Import Internal Dependencies
import { FACE } from "../../../utils/math.ts";
import { SQRT2_OVER_2 } from "../../../constants.ts";
import {
  defineFace,
  type FaceDefinition
} from "../../face/index.ts";
import { BlockShapeBase } from "../BlockShapeBase.ts";
import type {
  BlockCollisionHint,
  BlockShapeID
} from "../BlockShape.ts";

/**
 * Z-axis ramp whose NegY and PosZ faces fully occlude neighbours.
 */
export class Ramp extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "ramp"
  ) {
    super();
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
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
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]]
    }),
    defineFace({
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 1], [1, 0, 1]]
    }),
    defineFace({
      face: FACE.PosY,
      normal: [0, SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0]]
    })
  ];
}
