
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
import {
  SQRT2_OVER_2,
  SQRT3_OVER_3
} from "../../constants.ts";

/**
 * Concave ramp corner that occludes NegY, PosZ, and PosX.
 */
export class RampCornerInner implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerInner"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    projectedFace({
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
    }),
    projectedFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
    }),
    projectedFace({
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    }),
    projectedFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]]
    }),
    projectedFace({
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[0, 0, 0], [1, 1, 0], [1, 0, 0]]
    }),
    projectedFace({
      face: FACE.PosY,
      normal: [-SQRT3_OVER_3, SQRT3_OVER_3, -SQRT3_OVER_3],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 0]]
    }),
    projectedFace({
      face: FACE.PosY,
      cull: null,
      normal: [0, 1, 0],
      vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0]]
    })
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ || face === FACE.PosX;
  }
}

/**
 * Convex ramp corner whose bottom is its only fully occluding face.
 */
export class RampCornerOuter implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerOuter"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    projectedFace({
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
    }),
    projectedFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]]
    }),
    projectedFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [0, 1, 1]]
    }),
    projectedFace({
      face: FACE.NegZ,
      normal: [0, SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 0, 0]]
    }),
    projectedFace({
      face: FACE.PosX,
      normal: [SQRT2_OVER_2, SQRT2_OVER_2, 0],
      vertices: [[1, 0, 0], [0, 1, 1], [1, 0, 1]]
    })
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY;
  }
}

