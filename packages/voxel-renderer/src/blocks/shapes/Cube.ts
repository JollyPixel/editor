// Import Internal Dependencies
import {
  FACE
} from "../../utils/math.ts";
import { projectedFace } from "../faceUv.ts";
import type {
  BlockShape,
  FaceDefinition,
  BlockCollisionHint,
  BlockShapeID
} from "../BlockShape.ts";

/**
 * Full unit cube with counter-clockwise outward face winding.
 */
export class Cube implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "box";

  constructor(
    id: BlockShapeID = "cube"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    projectedFace({
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    }),
    projectedFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
    }),
    projectedFace({
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
    }),
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
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
    })
  ];

  occludes(
    _face: FACE
  ): boolean {
    return true;
  }
}
