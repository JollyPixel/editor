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

/**
 * PoleY — a narrow vertical post centered in the voxel cell.
 * Cross-section: x=[kW,kH] × z=[kW,kH] (0.25 wide), full height y=[0,1].
 * Uses trimesh collision for accurate sub-voxel physics.
 */
export class PoleY implements BlockShape {
  readonly id: BlockShapeID = "poleY";
  readonly collisionHint: BlockCollisionHint = "trimesh";

  readonly faces: readonly FaceDefinition[] = [
    {
      // Top (PosY, y=1)
      // e1=[0,0,kH-kW], e2=[kH-kW,0,kH-kW] → cross=[0,(kH-kW)^2,0] ✓
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[kW, 1, kW], [kW, 1, kH], [kH, 1, kH], [kH, 1, kW]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // Bottom (NegY, y=0)
      // e1=[0,0,kW-kH], e2=[kW-kH,0,kW-kH] → cross=[0,-(kH-kW)^2,0] ✓
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[kW, 0, kH], [kW, 0, kW], [kH, 0, kW], [kH, 0, kH]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosX side (x=H)
      // e1=[0,1,0], e2=[0,1,kH-kW] → cross=[kH-kW,0,0] ✓
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[kH, 0, kW], [kH, 1, kW], [kH, 1, kH], [kH, 0, kH]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // NegX side (x=W)
      // e1=[0,1,0], e2=[0,1,kW-kH] → cross=[kW-kH,0,0] ✓
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[kW, 0, kH], [kW, 1, kH], [kW, 1, kW], [kW, 0, kW]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosZ side (z=H)
      // e1=[kH-kW,0,0], e2=[kH-kW,1,0] → cross=[0,0,kH-kW] ✓
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[kW, 0, kH], [kH, 0, kH], [kH, 1, kH], [kW, 1, kH]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // NegZ side (z=W)
      // e1=[W-H,0,0], e2=[W-H,1,0] → cross=[0,0,W-H] ✓
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[kH, 0, kW], [kW, 0, kW], [kW, 1, kW], [kH, 1, kW]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }
  ];

  occludes(
    _face: FACE
  ): boolean {
    return false;
  }
}
