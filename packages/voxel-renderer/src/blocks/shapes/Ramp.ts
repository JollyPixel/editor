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
 * Ramp (slope) block: rises from y=0 at z=0 to y=1 at z=1.
 *
 * Faces:
 *  - Bottom (NegY): full flat base quad
 *  - Back (PosZ, z=1): full-height quad wall
 *  - Left (NegX, x=0): right triangle
 *  - Right (PosX, x=1): right triangle
 *  - Slope: diagonal quad, normal [0, 1/√2, -1/√2] (up + toward -Z)
 *
 * Occlusion: only NegY and PosZ are fully covered.
 * Non-axis-aligned faces (the slope) use PosY as the culling direction —
 * the slope is hidden if a solid block sits directly above it.
 */
export class Ramp implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "ramp"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    {
      // NegY (y=0): full flat bottom quad
      // e1=[0,0,-1], e2=[1,0,0] → cross=[0,-1,0] ✓
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosZ (z=1): full back wall quad
      // e1=[1,0,0], e2=[0,1,0] → cross=[0,0,1] ✓
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // NegX (x=0): left side triangle (y=z line)
      // e1=[0,0,1], e2=[0,1,0] → cross=[-1,0,0] ✓
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1]]
    },
    {
      // PosX (x=1): right side triangle (y=z line)
      // e1=[0,1,1], e2=[0,-1,0] → cross=[1,0,0] ✓
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 1], [1, 0, 1]],
      uvs: [[0, 0], [1, 1], [1, 0]]
    },
    {
      // Slope: diagonal quad, outward normal [0, 1/√2, -1/√2]
      // Cull against PosY neighbour: if a solid block sits above, slope is hidden.
      // e1=[0,1,1], e2=[1,0,0] → cross=[0,1,-1] (direction ✓, normalized below)
      face: FACE.PosY,
      normal: [0, SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    }
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ;
  }
}
