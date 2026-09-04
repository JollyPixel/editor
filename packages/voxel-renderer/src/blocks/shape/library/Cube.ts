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

/**
 * Full unit cube with counter-clockwise outward face winding.
 */
export class Cube extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "box";

  constructor(
    id: BlockShapeID = "cube"
  ) {
    super();
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    defineFace({
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
    }),
    defineFace({
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
    }),
    defineFace({
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
    }),
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
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
    })
  ];
}
