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

export type SlabType = "top" | "bottom";

/**
 * Half-height slab block.
 * "bottom" slab occupies y=[0, 0.5]; "top" slab occupies y=[0.5, 1].
 *
 * Occlusion: the full face (top or bottom, depending on type) is solid so
 * the adjacent block's opposite face can be culled. The half-height sides
 * do NOT occlude their neighbours — a neighbour must always emit its own face.
 */
export class Slab implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "box";
  readonly faces: readonly FaceDefinition[];

  constructor(
    type: SlabType = "bottom",
    id?: BlockShapeID
  ) {
    this.id = id ?? (type === "bottom" ? "slabBottom" : "slabTop");
    this.faces = Slab.#buildFaces(type);
  }

  occludes(
    face: FACE
  ): boolean {
    // Only the fully-covered flat face can occlude a neighbour.
    if (this.id.includes("Bottom") || this.id === "slabBottom") {
      return face === FACE.NegY;
    }

    return face === FACE.PosY;
  }

  static #buildFaces(
    type: SlabType
  ): FaceDefinition[] {
    const yLo = type === "bottom" ? 0 : 0.5;
    const yHi = type === "bottom" ? 0.5 : 1;

    return [
      {
        // Flat top face (at yHi)
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[0, yHi, 0], [0, yHi, 1], [1, yHi, 1], [1, yHi, 0]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // Flat bottom face (at yLo)
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[0, yLo, 1], [0, yLo, 0], [1, yLo, 0], [1, yLo, 1]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // PosX side (half height)
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, yLo, 0], [1, yHi, 0], [1, yHi, 1], [1, yLo, 1]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // NegX side (half height)
        face: FACE.NegX,
        normal: [-1, 0, 0],
        vertices: [[0, yLo, 1], [0, yHi, 1], [0, yHi, 0], [0, yLo, 0]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // PosZ side (half height)
        face: FACE.PosZ,
        normal: [0, 0, 1],
        vertices: [[0, yLo, 1], [1, yLo, 1], [1, yHi, 1], [0, yHi, 1]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      },
      {
        // NegZ side (half height)
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[1, yLo, 0], [0, yLo, 0], [0, yHi, 0], [1, yHi, 0]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      }
    ];
  }
}
