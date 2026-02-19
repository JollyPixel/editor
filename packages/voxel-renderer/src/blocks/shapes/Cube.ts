// Import Internal Dependencies
import {
  FACE
} from "../../utils/math.ts";
import type {
  BlockShape,
  FaceDefinition,
  BlockCollisionHint,
  BlockShapeID
} from "../BlockShape.ts";

/**
 * Cube — full unit cube. All 6 faces are quads covering the full face area,
 * so occludes() is true for every direction.
 *
 * Vertex winding: CCW when viewed from outside (cross-product of first two
 * edges equals the outward face normal, verified per-face below).
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
    {
      // PosX (x=1): normal [1,0,0]
      // e1=[0,1,0], e2=[0,0,1] → cross=[1,0,0] ✓
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // NegX (x=0): normal [-1,0,0]
      // e1=[0,1,0], e2=[0,0,-1] → cross=[-1,0,0] ✓
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
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
      // NegY (y=0): normal [0,-1,0]
      // e1=[0,0,-1], e2=[1,0,0] → cross=[0,-1,0] ✓
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosZ (z=1): normal [0,0,1]
      // e1=[1,0,0], e2=[0,1,0] → cross=[0,0,1] ✓
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // NegZ (z=0): normal [0,0,-1]
      // e1=[-1,0,0], e2=[0,1,0] → cross=[0,0,-1] ✓
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    }
  ];

  occludes(
    _face: FACE
  ): boolean {
    // A full cube covers every face completely.
    return true;
  }
}
