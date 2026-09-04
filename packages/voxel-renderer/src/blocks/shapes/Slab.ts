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

export type SlabType = "top" | "bottom";

/**
 * Half-height slab whose full horizontal face occludes its neighbour.
 */
export class Slab implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "box";
  readonly faces: readonly FaceDefinition[];

  #type: SlabType;

  constructor(
    type: SlabType = "bottom",
    id?: BlockShapeID
  ) {
    this.id = id ?? (type === "bottom" ? "slabBottom" : "slabTop");
    this.#type = type;
    this.faces = Slab.#buildFaces(type);
  }

  occludes(
    face: FACE
  ): boolean {
    const expectedFace = this.#type === "bottom"
      ? FACE.NegY
      : FACE.PosY;

    return face === expectedFace;
  }

  static #buildFaces(
    type: SlabType
  ): FaceDefinition[] {
    const yLo = type === "bottom" ? 0 : 0.5;
    const yHi = type === "bottom" ? 0.5 : 1;

    return [
      projectedFace({
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[0, yHi, 0], [0, yHi, 1], [1, yHi, 1], [1, yHi, 0]]
      }),
      projectedFace({
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[0, yLo, 1], [0, yLo, 0], [1, yLo, 0], [1, yLo, 1]]
      }),
      projectedFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, yLo, 0], [1, yHi, 0], [1, yHi, 1], [1, yLo, 1]]
      }),
      projectedFace({
        face: FACE.NegX,
        normal: [-1, 0, 0],
        vertices: [[0, yLo, 1], [0, yHi, 1], [0, yHi, 0], [0, yLo, 0]]
      }),
      projectedFace({
        face: FACE.PosZ,
        normal: [0, 0, 1],
        vertices: [[0, yLo, 1], [1, yLo, 1], [1, yHi, 1], [0, yHi, 1]]
      }),
      projectedFace({
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[1, yLo, 0], [0, yLo, 0], [0, yHi, 0], [1, yHi, 0]]
      })
    ];
  }
}
