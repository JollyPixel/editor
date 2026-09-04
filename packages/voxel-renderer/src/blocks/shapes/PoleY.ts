// Import Internal Dependencies
import {
  FACE
} from "../../utils/math.ts";
import type {
  BlockShape,
  BlockCollisionHint,
  BlockShapeID,
  FaceDefinition
} from "../BlockShape.ts";
import { projectedFace } from "../faceUv.ts";

// CONSTANTS
const kW = 3 / 8;
const kH = 5 / 8;

/**
 * Quarter-width vertical post centered in the voxel.
 */
export class PoleY implements BlockShape {
  readonly id: BlockShapeID = "poleY";
  readonly collisionHint: BlockCollisionHint = "trimesh";

  readonly faces: readonly FaceDefinition[] = [
    projectedFace({
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[kW, 1, kW], [kW, 1, kH], [kH, 1, kH], [kH, 1, kW]]
    }),
    projectedFace({
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[kW, 0, kH], [kW, 0, kW], [kH, 0, kW], [kH, 0, kH]]
    }),
    projectedFace({
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[kH, 0, kW], [kH, 1, kW], [kH, 1, kH], [kH, 0, kH]]
    }),
    projectedFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[kW, 0, kH], [kW, 1, kH], [kW, 1, kW], [kW, 0, kW]]
    }),
    projectedFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[kW, 0, kH], [kH, 0, kH], [kH, 1, kH], [kW, 1, kH]]
    }),
    projectedFace({
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[kH, 0, kW], [kW, 0, kW], [kW, 1, kW], [kH, 1, kW]]
    })
  ];

  occludes(
    _face: FACE
  ): boolean {
    return false;
  }
}
