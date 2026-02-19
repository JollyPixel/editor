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

// CONSTANTS
const kW = 3 / 8;
const kH = 5 / 8;

export type PoleAxis = "x" | "z";

/**
 * Pole — a narrow horizontal beam running along the X or Z axis.
 * Cross-section: 0.25×0.25 centered at 0.5, full length along the chosen axis.
 * Uses trimesh collision for accurate sub-voxel physics.
 *
 * "poleZ": z=[0,1], centered x=[kW,kH], y=[kW,kH]
 * "poleX": x=[0,1], centered z=[kW,kH], y=[kW,kH]
 */
export class Pole implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";
  readonly faces: readonly FaceDefinition[];

  constructor(
    axis: PoleAxis = "z"
  ) {
    this.id = axis === "z" ? "poleZ" : "poleX";
    this.faces = axis === "z" ?
      Pole.#buildZFaces() :
      Pole.#buildXFaces();
  }

  occludes(
    _face: FACE
  ): boolean {
    return false;
  }

  static #buildZFaces(): FaceDefinition[] {
    // Beam along Z: z=[0,1], centered x=[kW,kH], y=[kW,kH]
    return [
      {
        // NegZ cap (z=0)
        // e1=[kW-kH,0,0], e2=[kW-kH,kH-kW,0] → cross=[0,0,-(kH-kW)^2] ✓
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[kH, kW, 0], [kW, kW, 0], [kW, kH, 0], [kH, kH, 0]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      },
      {
        // PosZ cap (z=1)
        // e1=[kH-kW,0,0], e2=[kH-kW,kH-kW,0] → cross=[0,0,(kH-kW)^2] ✓
        face: FACE.PosZ,
        normal: [0, 0, 1],
        vertices: [[kW, kW, 1], [kH, kW, 1], [kH, kH, 1], [kW, kH, 1]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      },
      {
        // Top (PosY, y=kH)
        // e1=[0,0,1], e2=[kH-kW,0,1] → cross=[0,kH-kW,0] ✓
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[kW, kH, 0], [kW, kH, 1], [kH, kH, 1], [kH, kH, 0]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // Bottom (NegY, y=kW)
        // e1=[0,0,-1], e2=[kH-kW,0,-1] → cross=[0,-(kH-kW),0] ✓
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[kW, kW, 1], [kW, kW, 0], [kH, kW, 0], [kH, kW, 1]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // NegX side (x=kW)
        // e1=[0,kH-kW,0], e2=[0,kH-kW,-1] → cross=[-(kH-kW),0,0] ✓
        face: FACE.NegX,
        normal: [-1, 0, 0],
        vertices: [[kW, kW, 1], [kW, kH, 1], [kW, kH, 0], [kW, kW, 0]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // PosX side (x=kH)
        // e1=[0,kH-kW,0], e2=[0,kH-kW,1] → cross=[kH-kW,0,0] ✓
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[kH, kW, 0], [kH, kH, 0], [kH, kH, 1], [kH, kW, 1]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      }
    ];
  }

  static #buildXFaces(): FaceDefinition[] {
    // Beam along X: x=[0,1], centered z=[kW,kH], y=[kW,kH]
    return [
      {
        // NegX cap (x=0)
        // e1=[0,kH-kW,0], e2=[0,kH-kW,kW-kH] → cross=[-(kH-kW)^2,0,0] ✓
        face: FACE.NegX,
        normal: [-1, 0, 0],
        vertices: [[0, kW, kH], [0, kH, kH], [0, kH, kW], [0, kW, kW]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // PosX cap (x=1)
        // e1=[0,kH-kW,0], e2=[0,kH-kW,kH-kW] → cross=[(kH-kW)^2,0,0] ✓
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, kW, kW], [1, kH, kW], [1, kH, kH], [1, kW, kH]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // Top (PosY, y=kH)
        // e1=[0,0,kH-kW], e2=[1,0,kH-kW] → cross=[0,(kH-kW),0] ✓
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[0, kH, kW], [0, kH, kH], [1, kH, kH], [1, kH, kW]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // Bottom (NegY, y=kW)
        // e1=[0,0,kW-kH], e2=[1,0,kW-kH] → cross=[0,kW-kH,0] ✓
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[0, kW, kH], [0, kW, kW], [1, kW, kW], [1, kW, kH]],
        uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
      },
      {
        // NegZ side (z=kW)
        // e1=[-1,0,0], e2=[-1,kH-kW,0] → cross=[0,0,-(kH-kW)] ✓
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[1, kW, kW], [0, kW, kW], [0, kH, kW], [1, kH, kW]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      },
      {
        // PosZ side (z=kH)
        // e1=[1,0,0], e2=[1,kH-kW,0] → cross=[0,0,kH-kW] ✓
        face: FACE.PosZ,
        normal: [0, 0, 1],
        vertices: [[0, kW, kH], [1, kW, kH], [1, kH, kH], [0, kH, kH]],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
      }
    ];
  }
}
