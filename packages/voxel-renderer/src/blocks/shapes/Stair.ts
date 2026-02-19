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

// CONSTANTS
const kStairFaces: readonly FaceDefinition[] = [
  {
    // NegY: full flat bottom quad
    face: FACE.NegY,
    normal: [0, -1, 0],
    vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
  },
  {
    // PosZ: full back wall y=0..1 (high step at back)
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
  },
  {
    // NegZ: lower front wall y=0..0.5
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0], [1, 0.5, 0]],
    uvs: [[1, 0], [0, 0], [0, 0.5], [1, 0.5]]
  },
  {
    // PosY: front step top y=0.5, z=0..0.5
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 0.5, 0], [0, 0.5, 0.5], [1, 0.5, 0.5], [1, 0.5, 0]],
    uvs: [[0, 0], [0, 0.5], [1, 0.5], [1, 0]]
  },
  {
    // PosY: back top y=1, z=0.5..1
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0.5], [0, 1, 1], [1, 1, 1], [1, 1, 0.5]],
    uvs: [[0, 0.5], [0, 1], [1, 1], [1, 0.5]]
  },
  {
    // Inner riser at z=0.5, y=0.5..1, facing NegZ (always visible)
    face: 6 as FACE,
    normal: [0, 0, -1],
    vertices: [[1, 0.5, 0.5], [0, 0.5, 0.5], [0, 1, 0.5], [1, 1, 0.5]],
    uvs: [[1, 0], [0, 0], [0, 0.5], [1, 0.5]]
  },
  {
    // PosX: right lower quad y=0..0.5, z=0..1
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]],
    uvs: [[0, 0], [0, 0.5], [1, 0.5], [1, 0]]
  },
  {
    // PosX: right upper back quad y=0.5..1, z=0.5..1
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0.5, 0.5], [1, 1, 0.5], [1, 1, 1], [1, 0.5, 1]],
    uvs: [[0.5, 0.5], [0.5, 1], [1, 1], [1, 0.5]]
  },
  {
    // NegX: left lower quad y=0..0.5, z=0..1
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 1], [0, 0.5, 1], [0, 0.5, 0], [0, 0, 0]],
    uvs: [[1, 0], [1, 0.5], [0, 0.5], [0, 0]]
  },
  {
    // NegX: left upper back quad y=0.5..1, z=0.5..1
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0.5, 1], [0, 1, 1], [0, 1, 0.5], [0, 0.5, 0.5]],
    uvs: [[1, 0.5], [1, 1], [0.5, 1], [0.5, 0.5]]
  }
];

const kStairCornerInnerFaces: readonly FaceDefinition[] = [
  {
    // NegY: full flat bottom quad
    face: FACE.NegY,
    normal: [0, -1, 0],
    vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
  },
  {
    // PosZ: full back wall y=0..1
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]]
  },
  {
    // PosX: full right wall y=0..1
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
    uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
  },
  {
    // NegZ: lower front wall y=0..0.5, x=0..1
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0], [1, 0.5, 0]],
    uvs: [[1, 0], [0, 0], [0, 0.5], [1, 0.5]]
  },
  {
    // NegX: lower left wall y=0..0.5, z=0..1
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 1], [0, 0.5, 1], [0, 0.5, 0], [0, 0, 0]],
    uvs: [[1, 0], [1, 0.5], [0, 0.5], [0, 0]]
  },
  {
    // PosY: step platform y=0.5, x=0..0.5, z=0..0.5 (missing upper quadrant)
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 0.5, 0], [0, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, 0]],
    uvs: [[0, 0], [0, 0.5], [0.5, 0.5], [0.5, 0]]
  },
  {
    // PosY: back top y=1, z=0.5..1, x=0..1
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0.5], [0, 1, 1], [1, 1, 1], [1, 1, 0.5]],
    uvs: [[0, 0.5], [0, 1], [1, 1], [1, 0.5]]
  },
  {
    // PosY: front-right top y=1, z=0..0.5, x=0.5..1
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0.5, 1, 0], [0.5, 1, 0.5], [1, 1, 0.5], [1, 1, 0]],
    uvs: [[0.5, 0], [0.5, 0.5], [1, 0.5], [1, 0]]
  },
  {
    // Inner riser at z=0.5, y=0.5..1, x=0..0.5 (facing NegZ, always visible)
    face: 6 as FACE,
    normal: [0, 0, -1],
    vertices: [[0.5, 0.5, 0.5], [0, 0.5, 0.5], [0, 1, 0.5], [0.5, 1, 0.5]],
    uvs: [[0.5, 0], [0, 0], [0, 0.5], [0.5, 0.5]]
  },
  {
    // Inner riser at x=0.5, y=0.5..1, z=0..0.5 (facing NegX, always visible)
    face: 6 as FACE,
    normal: [-1, 0, 0],
    vertices: [[0.5, 0.5, 0], [0.5, 0.5, 0.5], [0.5, 1, 0.5], [0.5, 1, 0]],
    uvs: [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0.5]]
  }
];

const kStairCornerOuterFaces: readonly FaceDefinition[] = [
  {
    // NegY: full flat bottom quad
    face: FACE.NegY,
    normal: [0, -1, 0],
    vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    uvs: [[0, 0], [0, 1], [1, 1], [1, 0]]
  },
  {
    // NegZ: lower front wall y=0..0.5, x=0..1
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0], [1, 0.5, 0]],
    uvs: [[1, 0], [0, 0], [0, 0.5], [1, 0.5]]
  },
  {
    // NegZ: upper front wall y=0.5..1, x=0..0.5 (left only — upper block)
    face: FACE.NegZ,
    normal: [0, 0, -1],
    vertices: [[0.5, 0.5, 0], [0, 0.5, 0], [0, 1, 0], [0.5, 1, 0]],
    uvs: [[0.5, 0.5], [0, 0.5], [0, 1], [0.5, 1]]
  },
  {
    // NegX: lower left wall y=0..0.5, z=0..1
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0, 1], [0, 0.5, 1], [0, 0.5, 0], [0, 0, 0]],
    uvs: [[1, 0], [1, 0.5], [0, 0.5], [0, 0]]
  },
  {
    // NegX: upper left wall y=0.5..1, z=0..0.5 (front only — upper block)
    face: FACE.NegX,
    normal: [-1, 0, 0],
    vertices: [[0, 0.5, 0], [0, 0.5, 0.5], [0, 1, 0.5], [0, 1, 0]],
    uvs: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]]
  },
  {
    // PosZ: lower back wall y=0..0.5 (no upper block at back)
    face: FACE.PosZ,
    normal: [0, 0, 1],
    vertices: [[0, 0, 1], [1, 0, 1], [1, 0.5, 1], [0, 0.5, 1]],
    uvs: [[0, 0], [1, 0], [1, 0.5], [0, 0.5]]
  },
  {
    // PosX: lower right wall y=0..0.5
    face: FACE.PosX,
    normal: [1, 0, 0],
    vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]],
    uvs: [[0, 0], [0, 0.5], [1, 0.5], [1, 0]]
  },
  {
    // PosY: upper block top y=1, x=0..0.5, z=0..0.5
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 1, 0], [0, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, 0]],
    uvs: [[0, 0], [0, 0.5], [0.5, 0.5], [0.5, 0]]
  },
  {
    // PosY: slab top, front-right quadrant, x=0.5..1, z=0..0.5, y=0.5
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0.5, 0.5, 0], [0.5, 0.5, 0.5], [1, 0.5, 0.5], [1, 0.5, 0]],
    uvs: [[0.5, 0], [0.5, 0.5], [1, 0.5], [1, 0]]
  },
  {
    // PosY: slab top, back-left quadrant, x=0..0.5, z=0.5..1, y=0.5
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0, 0.5, 0.5], [0, 0.5, 1], [0.5, 0.5, 1], [0.5, 0.5, 0.5]],
    uvs: [[0, 0.5], [0, 1], [0.5, 1], [0.5, 0.5]]
  },
  {
    // PosY: slab top, back-right quadrant, x=0.5..1, z=0.5..1, y=0.5
    face: FACE.PosY,
    normal: [0, 1, 0],
    vertices: [[0.5, 0.5, 0.5], [0.5, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0.5]],
    uvs: [[0.5, 0.5], [0.5, 1], [1, 1], [1, 0.5]]
  },
  {
    // Inner riser at x=0.5, y=0.5..1, z=0..0.5 (right side of upper block, facing PosX, always visible)
    face: 6 as FACE,
    normal: [1, 0, 0],
    vertices: [[0.5, 0.5, 0.5], [0.5, 0.5, 0], [0.5, 1, 0], [0.5, 1, 0.5]],
    uvs: [[0.5, 0.5], [0, 0.5], [0, 1], [0.5, 1]]
  },
  {
    // Inner riser at z=0.5, y=0.5..1, x=0..0.5 (back side of upper block, facing PosZ, always visible)
    face: 6 as FACE,
    normal: [0, 0, 1],
    vertices: [[0, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 1, 0.5], [0, 1, 0.5]],
    uvs: [[0, 0.5], [0.5, 0.5], [0.5, 1], [0, 1]]
  }
];

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

const kStairFlipFaces = kStairFaces.map(yFlipFace);
const kStairCornerInnerFlipFaces = kStairCornerInnerFaces.map(yFlipFace);
const kStairCornerOuterFlipFaces = kStairCornerOuterFaces.map(yFlipFace);

/**
 * Stair — L-cross-section stair block.
 * Full bottom slab + upper half-block at back (z=0.5..1). High step at PosZ.
 *
 * Occludes: NegY, PosZ.
 * collisionHint: trimesh.
 */
export class Stair implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stair"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ;
  }
}

/**
 * StairCornerInner — concave inner corner stair.
 * Full bottom slab; upper L-shaped block (3/4 top), missing front-left quadrant.
 * Two inner risers at the step edge.
 *
 * Occludes: NegY, PosZ, PosX.
 * collisionHint: trimesh.
 */
export class StairCornerInner implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairCornerInner"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairCornerInnerFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY || face === FACE.PosZ || face === FACE.PosX;
  }
}

/**
 * StairCornerOuter — convex outer corner stair.
 * Full bottom slab; upper quarter-block only at front-left (x=0..0.5, z=0..0.5).
 * Two inner risers on the right/back sides of the upper block.
 *
 * Occludes: NegY only.
 * collisionHint: trimesh.
 */
export class StairCornerOuter implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairCornerOuter"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairCornerOuterFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.NegY;
  }
}

/**
 * StairFlip — Y-flipped Stair (hangs from ceiling at PosY).
 *
 * Occludes: PosY, PosZ.
 * collisionHint: trimesh.
 */
export class StairFlip implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairFlip"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairFlipFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.PosY || face === FACE.PosZ;
  }
}

/**
 * StairCornerInnerFlip — Y-flipped StairCornerInner (hangs from ceiling).
 *
 * Occludes: PosY, PosZ, PosX.
 * collisionHint: trimesh.
 */
export class StairCornerInnerFlip implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairCornerInnerFlip"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairCornerInnerFlipFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.PosY || face === FACE.PosZ || face === FACE.PosX;
  }
}

/**
 * StairCornerOuterFlip — Y-flipped StairCornerOuter (hangs from ceiling).
 *
 * Occludes: PosY only.
 * collisionHint: trimesh.
 */
export class StairCornerOuterFlip implements BlockShape {
  readonly id: BlockShapeID;
  readonly collisionHint: BlockCollisionHint = "trimesh";

  constructor(
    id: BlockShapeID = "stairCornerOuterFlip"
  ) {
    this.id = id;
  }

  readonly faces: readonly FaceDefinition[] = kStairCornerOuterFlipFaces;

  occludes(
    face: FACE
  ): boolean {
    return face === FACE.PosY;
  }
}
