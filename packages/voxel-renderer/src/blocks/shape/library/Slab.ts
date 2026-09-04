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

export type SlabType = "top" | "bottom";

/**
 * Half-height slab whose full horizontal face occludes its neighbour.
 */
export class Slab extends BlockShapeBase {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "box";
  readonly faces: readonly FaceDefinition[];

  constructor(
    type: SlabType = "bottom",
    id?: BlockShapeID
  ) {
    super();
    this.id = id ?? (type === "bottom" ? "slabBottom" : "slabTop");
    this.faces = Slab.#buildFaces(type);
  }

  static #buildFaces(
    type: SlabType
  ): FaceDefinition[] {
    const yLo = type === "bottom" ? 0 : 0.5;
    const yHi = type === "bottom" ? 0.5 : 1;

    return [
      defineFace({
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[0, yHi, 0], [0, yHi, 1], [1, yHi, 1], [1, yHi, 0]]
      }),
      defineFace({
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[0, yLo, 1], [0, yLo, 0], [1, yLo, 0], [1, yLo, 1]]
      }),
      defineFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, yLo, 0], [1, yHi, 0], [1, yHi, 1], [1, yLo, 1]]
      }),
      defineFace({
        face: FACE.NegX,
        normal: [-1, 0, 0],
        vertices: [[0, yLo, 1], [0, yHi, 1], [0, yHi, 0], [0, yLo, 0]]
      }),
      defineFace({
        face: FACE.PosZ,
        normal: [0, 0, 1],
        vertices: [[0, yLo, 1], [1, yLo, 1], [1, yHi, 1], [0, yHi, 1]]
      }),
      defineFace({
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[1, yLo, 0], [0, yLo, 0], [0, yHi, 0], [1, yHi, 0]]
      })
    ];
  }
}
