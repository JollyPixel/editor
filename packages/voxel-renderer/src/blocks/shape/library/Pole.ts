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
const kW = 3 / 8;
const kH = 5 / 8;

/**
 * Quarter-width horizontal beam spanning the voxel's Z axis.
 */
export class Pole extends BlockShapeBase {
  readonly id: BlockShapeID = "pole";
  readonly collisionHint: BlockCollisionHint = "trimesh";

  readonly faces: readonly FaceDefinition[] = [
    defineFace({
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[kH, kW, 0], [kW, kW, 0], [kW, kH, 0], [kH, kH, 0]]
    }),
    defineFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[kW, kW, 1], [kH, kW, 1], [kH, kH, 1], [kW, kH, 1]]
    }),
    defineFace({
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[kW, kH, 0], [kW, kH, 1], [kH, kH, 1], [kH, kH, 0]]
    }),
    defineFace({
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[kW, kW, 1], [kW, kW, 0], [kH, kW, 0], [kH, kW, 1]]
    }),
    defineFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[kW, kW, 1], [kW, kH, 1], [kW, kH, 0], [kW, kW, 0]]
    }),
    defineFace({
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[kH, kW, 0], [kH, kH, 0], [kH, kH, 1], [kH, kW, 1]]
    })
  ];
}
