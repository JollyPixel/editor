// Import Internal Dependencies
import type {
  BlockShape,
  BlockCollisionHint,
  BlockShapeID,
  FaceDefinition
} from "../BlockShape.ts";
import {
  FACE
} from "../../utils/math.ts";
import {
  SQRT2_OVER_2
} from "../../constants.ts";

/**
 * RampFlip — Y-flipped ramp: full-height at z=1, tapers to a top ridge at z=0.
 * Flat face is at the top (PosY) instead of the bottom. Essentially a ramp
 * mounted upside-down.
 *
 * Geometry (same cross-section as Ramp but oriented toward -Z):
 *  z=1 face: full-height quad (back wall)
 *  z=0 edge: top ridge at y=1
 *
 * Occludes: PosY, NegY, and PosZ.
 */
export class RampFlip implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampFlip"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    {
      // PosX (x=1): right side triangle
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 1, 0], [1, 1, 1], [1, 0, 1]],
      uvs: [[0, 1], [1, 1], [1, 0]]
    },
    {
      // NegX (x=0): left side triangle (ridge at y=1,z=0 down to y=0,z=1)
      // e1=[0,0,1], e2=[0,1,0] → cross=[-1,0,0] ✓
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 1, 0], [0, 0, 1], [0, 1, 1]],
      uvs: [[0, 1], [1, 0], [1, 1]]
    },
    {
      // PosY (y=1): normal [0,1,0]
      // e1=[0,0,1], e2=[1,0,0] → cross=[0,1,0] ✓
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // Slope: diagonal quad rising from y=0 at z=1 to y=1 at z=0.
      // Same diagonal face as Ramp but "facing" NegZ.
      // Vertices: (0,1,0),(0,0,1),(1,0,1),(1,1,0)
      // e1=[0,-1,1], e2=[1,0,0] → cross=[0,1,1] → [0,1/√2,1/√2]...
      // The slope top ridge is at y=1, z=0, and bottom is at y=0, z=1.
      // Correct CCW winding for outward normal [0, 1/√2, 1/√2] (up + toward +Z):
      // v0=(0,0,1), v1=(0,1,0), v2=(1,1,0), v3=(1,0,1)
      // e1=[0,1,-1], e2=[1,0,0] → cross=[0,1,1] → [0,1/√2,1/√2] ✓
      face: FACE.NegY,
      normal: [0, -SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosZ (z=1): full back wall quad
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.PosY || face === FACE.NegY || face === FACE.PosZ;
  }
}
