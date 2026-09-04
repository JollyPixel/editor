// Import Internal Dependencies
import { FACE } from "../../../utils/math.ts";
import {
  SQRT2_OVER_2,
  SQRT3_OVER_3
} from "../../../constants.ts";
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
 * Concave ramp corner that occludes NegY, PosZ, and PosX.
 */
export class RampCornerInner extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerInner"
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
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    }),
    defineFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]]
    }),
    defineFace({
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[0, 0, 0], [1, 1, 0], [1, 0, 0]]
    }),
    defineFace({
      face: FACE.PosY,
      normal: [-SQRT3_OVER_3, SQRT3_OVER_3, -SQRT3_OVER_3],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 0]]
    }),
    defineFace({
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0]]
    })
  ];
}

/**
 * Convex ramp corner whose bottom is its only fully occluding face.
 */
export class RampCornerOuter extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerOuter"
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
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]]
    }),
    defineFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [0, 1, 1]]
    }),
    defineFace({
      face: FACE.NegZ,
      normal: [0, SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 0, 0]]
    }),
    defineFace({
      face: FACE.PosX,
      normal: [SQRT2_OVER_2, SQRT2_OVER_2, 0],
      vertices: [[1, 0, 0], [0, 1, 1], [1, 0, 1]]
    })
  ];
}
