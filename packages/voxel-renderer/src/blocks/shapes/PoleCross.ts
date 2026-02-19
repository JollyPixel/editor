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
 * PoleCross — a horizontal plus/cross connector at mid-height.
 * Two beams (along X and Z) merge at the center at y=[kW,kH].
 * Internal faces at the intersection are omitted to avoid overdraw.
 *
 * 18 faces total:
 *   3 top (PosY)  + 3 bottom (NegY)
 *   4 end caps    (NegX, PosX, NegZ, PosZ)
 *   4 Z-beam outer sides (x=kW and x=kH for z=[0,kW] and z=[kH,1])
 *   4 X-beam outer sides (z=kW and z=kH for x=[0,kW] and x=[kH,1])
 */
export class PoleCross implements BlockShape {
  readonly id: BlockShapeID = "poleCross";
  readonly collisionHint: BlockCollisionHint = "trimesh";

  readonly faces: readonly FaceDefinition[] = [
    // ── Top (PosY, y=kH) — 3 quads ──────────────────────────────────────────
    {
      // Z-strip: x=[kW,kH], z=[0,1]
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[kW, kH, 0], [kW, kH, 1], [kH, kH, 1], [kH, kH, 0]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // Left X-arm: x=[0,kW], z=[kW,kH]
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[0, kH, kW], [0, kH, kH], [kW, kH, kH], [kW, kH, kW]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // Right X-arm: x=[kH,1], z=[kW,kH]
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[kH, kH, kW], [kH, kH, kH], [1, kH, kH], [1, kH, kW]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },

    // ── Bottom (NegY, y=kW) — 3 quads ────────────────────────────────────────
    {
      // Z-strip: x=[kW,kH], z=[0,1]
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[kW, kW, 1], [kW, kW, 0], [kH, kW, 0], [kH, kW, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // Left X-arm: x=[0,kW], z=[kW,kH]
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, kW, kH], [0, kW, kW], [kW, kW, kW], [kW, kW, kH]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // Right X-arm: x=[kH,1], z=[kW,kH]
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[kH, kW, kH], [kH, kW, kW], [1, kW, kW], [1, kW, kH]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },

    // ── End caps — 4 quads ───────────────────────────────────────────────────
    {
      // NegX cap (x=0): x-arm end, cross-section z=[kW,kH] y=[kW,kH]
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, kW, kH], [0, kH, kH], [0, kH, kW], [0, kW, kW]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosX cap (x=1): x-arm end, cross-section z=[kW,kH] y=[kW,kH]
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, kW, kW], [1, kH, kW], [1, kH, kH], [1, kW, kH]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // NegZ cap (z=0): z-arm end, cross-section x=[kW,kH] y=[kW,kH]
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[kH, kW, 0], [kW, kW, 0], [kW, kH, 0], [kH, kH, 0]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // PosZ cap (z=1): z-arm end, cross-section x=[kW,kH] y=[kW,kH]
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[kW, kW, 1], [kH, kW, 1], [kH, kH, 1], [kW, kH, 1]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },

    // ── Z-beam outer sides (x=kW and x=kH, excluding intersection z=[kW,kH]) ─
    {
      // NegX (x=kW), z=[0,kW] segment
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[kW, kW, kW], [kW, kH, kW], [kW, kH, 0], [kW, kW, 0]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // NegX (x=kW), z=[kH,1] segment
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[kW, kW, 1], [kW, kH, 1], [kW, kH, kH], [kW, kW, kH]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosX (x=kH), z=[0,kW] segment
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[kH, kW, 0], [kH, kH, 0], [kH, kH, kW], [kH, kW, kW]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosX (x=kH), z=[kH,1] segment
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[kH, kW, kH], [kH, kH, kH], [kH, kH, 1], [kH, kW, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },

    // ── X-beam outer sides (z=kW and z=kH, excluding intersection x=[kW,kH]) ─
    {
      // NegZ (z=kW), x=[0,kW] segment
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[kW, kW, kW], [0, kW, kW], [0, kH, kW], [kW, kH, kW]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // NegZ (z=kW), x=[kH,1] segment
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[1, kW, kW], [kH, kW, kW], [kH, kH, kW], [1, kH, kW]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // PosZ (z=kH), x=[0,kW] segment
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, kW, kH], [kW, kW, kH], [kW, kH, kH], [0, kH, kH]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // PosZ (z=kH), x=[kH,1] segment
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[kH, kW, kH], [1, kW, kH], [1, kH, kH], [kH, kH, kH]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }
  ];

  occludes(
    _face: FACE
  ): boolean {
    return false;
  }
}
