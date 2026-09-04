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
 * Quarter-width horizontal beam spanning the voxel's Z axis.
 */
export class Pole implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";
  readonly faces: readonly FaceDefinition[];

  constructor() {
    this.id = "pole";
    this.faces = Pole.#buildZFaces();
  }

  occludes(
    _face: FACE
  ): boolean {
    return false;
  }

  static #buildZFaces(): FaceDefinition[] {
    return [
      projectedFace({
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[kH, kW, 0], [kW, kW, 0], [kW, kH, 0], [kH, kH, 0]]
      }),
      projectedFace({
        face: FACE.PosZ,
        normal: [0, 0, 1],
        vertices: [[kW, kW, 1], [kH, kW, 1], [kH, kH, 1], [kW, kH, 1]]
      }),
      projectedFace({
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[kW, kH, 0], [kW, kH, 1], [kH, kH, 1], [kH, kH, 0]]
      }),
      projectedFace({
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[kW, kW, 1], [kW, kW, 0], [kH, kW, 0], [kH, kW, 1]]
      }),
      projectedFace({
        face: FACE.NegX,
        normal: [-1, 0, 0],
        vertices: [[kW, kW, 1], [kW, kH, 1], [kW, kH, 0], [kW, kW, 0]]
      }),
      projectedFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[kH, kW, 0], [kH, kH, 0], [kH, kH, 1], [kH, kW, 1]]
      })
    ];
  }
}
