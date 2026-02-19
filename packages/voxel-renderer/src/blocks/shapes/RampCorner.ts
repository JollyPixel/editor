
// Import Internal Dependencies
import type {
  BlockShape,
  BlockCollisionHint,
  BlockShapeID,
  FaceDefinition
} from "../BlockShape.ts";
import {
  type Vec2,
  type Vec3,
  FACE
} from "../../utils/math.ts";
import {
  SQRT2_OVER_2,
  SQRT3_OVER_3
} from "../../constants.ts";

/**
 * RampCornerInner — concave inner corner where two ramps meet.
 * Has two full solid walls at PosZ (z=1) and PosX (x=1), a flat bottom,
 * and a diagonal slope face rising toward the corner (x=1, z=1).
 *
 * Occludes: NegY, PosZ, PosX.
 * Diagonal slope uses PosY as culling direction.
 */
export class RampCornerInner implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerInner"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    {
      // NegY: full flat bottom quad
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // PosZ (z=1): full back wall quad
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
    },
    {
      // PosX (x=1): full right wall quad
      face: FACE.PosX,
      normal: [1, 0, 0],
      vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // NegX (x=0): partial triangular side (left slope edge)
      // e1=[0,0,1], e2=[0,1,0] → cross=[-1,0,0] ✓
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1]]
    },
    {
      // NegZ (z=0): partial triangular side (front slope edge)
      // e1=[1,1,0], e2=[0,-1,0] → cross=[0,0,-1] ✓
      face: FACE.NegZ,
      normal: [0, 0, -1],
      vertices: [[0, 0, 0], [1, 1, 0], [1, 0, 0]],
      uvs: [[0, 0], [1, 1], [1, 0]]
    },
    {
      // Diagonal slope face: rises from (0,0,0) to corner height.
      // Vertices: (0,0,0), (0,1,1), (1,1,0) form the slope triangle.
      // e1=[0,1,1], e2=[1,0,-1] → cross=[-1,1,-1] (points up-left-front, outward)
      // Cull against PosY: hidden if block sits above.
      face: FACE.PosY,
      normal: [-SQRT3_OVER_3, SQRT3_OVER_3, -SQRT3_OVER_3],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
      uvs: [[0, 0], [0, 1], [1, 1]]
    },
    {
      // Diagonal slope face: rises from (0,0,0) to corner height.
      // Vertices: (0,0,0), (0,1,1), (1,1,0) form the slope triangle.
      // e1=[0,1,1], e2=[1,0,-1] → cross=[-1,1,-1] (points up-left-front, outward)
      // Cull against PosY: hidden if block sits above.
      face: 6 as FACE,
      normal: [0, 1, 0],
      vertices: [[0, 1, 1], [1, 1, 1], [1, 1, 0]],
      uvs: [[0, 0], [0, 1], [1, 1]]
    }
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ || face === FACE.PosX;
  }
}

/**
 * RampCornerOuter — convex outer corner (quarter-pyramid).
 * Peaks at (x=0, z=1) with height 1; all other corners at y=0.
 *
 * Faces:
 *  - NegY: full bottom quad
 *  - NegX (x=0): rising left wall triangle
 *  - PosZ (z=1): rising back wall triangle
 *  - Two diagonal slope triangles
 *
 * Occludes: only NegY (full bottom).
 */
export class RampCornerOuter implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerOuter"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = [
    {
      // NegY: full flat bottom quad
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
    },
    {
      // NegX (x=0): left rising wall triangle [0,0,0]→[0,0,1]→[0,1,1]
      // e1=[0,0,1], e2=[0,1,0] → cross=[-1,0,0] ✓
      face: FACE.NegX,
      normal: [-1, 0, 0],
      vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [1, 1]]
    },
    {
      // PosZ (z=1): back rising wall triangle [0,0,1]→[1,0,1]→[0,1,1]
      // e1=[1,0,0], e2=[-1,1,0] → cross=[0,0,1] ✓
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [0, 1, 1]],
      uvs: [[0, 0], [1, 0], [0, 1]]
    },
    {
      // Front-left diagonal slope [0,0,0]→[0,1,1]→[1,0,0]
      // e1=[0,1,1], e2=[1,-1,-1] → cross=[0,1,-1] → [0,1/√2,-1/√2]
      // Cull against NegZ (slope faces toward front)
      face: FACE.NegZ,
      normal: [0, SQRT2_OVER_2, -SQRT2_OVER_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 0, 0]],
      uvs: [[0, 0], [0, 1], [1, 0]]
    },
    {
      // Right diagonal slope [1,0,0]→[0,1,1]→[1,0,1]
      // e1=[-1,1,1], e2=[1,-1,0] → cross=[1,1,0] → [1/√2,1/√2,0]
      // Cull against PosX (slope faces outward to the right)
      face: FACE.PosX,
      normal: [SQRT2_OVER_2, SQRT2_OVER_2, 0],
      vertices: [[1, 0, 0], [0, 1, 1], [1, 0, 1]],
      uvs: [[0, 0], [0, 1], [1, 0]]
    }
  ];

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY;
  }
}

// -- Reverse variants (Y-flipped) -------------------------------------------

function yFlipFace(fd: FaceDefinition): FaceDefinition {
  const flippedAndReversed = fd.vertices
    .map(([x, y, z]) => [x, 1 - y, z] as Vec3)
    .reverse() as Vec3[];
  const reversedUvs = [...fd.uvs].reverse() as Vec2[];

  let flippedFace: FACE;
  if (fd.face === FACE.NegY) {
    flippedFace = FACE.PosY;
  }
  else if (fd.face === FACE.PosY) {
    flippedFace = FACE.NegY;
  }
  else {
    flippedFace = fd.face;
  }

  const flippedNormal: Vec3 = [fd.normal[0], -fd.normal[1], fd.normal[2]];

  return { face: flippedFace, normal: flippedNormal, vertices: flippedAndReversed, uvs: reversedUvs };
}

const kRampCornerInnerFlipFaces = new RampCornerInner().faces.map(yFlipFace);
const kRampCornerOuterFlipFaces = new RampCornerOuter().faces.map(yFlipFace);

/**
 * RampCornerInnerFlip — Y-flipped RampCornerInner (hangs from ceiling).
 * Flat ceiling at PosY, full walls PosZ + PosX, diagonal slope descends downward.
 *
 * Occludes: PosY, PosZ, PosX.
 */
export class RampCornerInnerFlip implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerInnerFlip"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kRampCornerInnerFlipFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.PosY || face === FACE.PosZ || face === FACE.PosX;
  }
}

/**
 * RampCornerOuterFlip — Y-flipped RampCornerOuter (quarter-pyramid hanging from ceiling).
 * Flat ceiling at PosY, slope descends downward.
 *
 * Occludes: PosY only.
 */
export class RampCornerOuterFlip implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "rampCornerOuterFlip"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kRampCornerOuterFlipFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.PosY;
  }
}
