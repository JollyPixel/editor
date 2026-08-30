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
import {
  SQRT2_OVER_2
} from "../../constants.ts";

/**
 * Z-axis ramp whose NegY and PosZ faces fully occlude neighbours.
 */
export class Ramp implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "ramp"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
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
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1]]
    },
    {
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
      uvs: [[0, 0], [1, 1], [1, 0]]
    },
    {
      face: FACE.PosY,
      normal: [0, SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    }
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ;
  }
}
