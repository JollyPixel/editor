// Import Internal Dependencies
import type { Vec3, FACE } from "../utils/math.ts";

export const FACE_NORMALS: readonly Vec3[] = [
  // PosX
  [1, 0, 0],
  // NegX
  [-1, 0, 0],
  // PosY
  [0, 1, 0],
  // NegY
  [0, -1, 0],
  // PosZ
  [0, 0, 1],
  // NegZ
  [0, 0, -1]
];

// Neighbor offset per face direction (same as normals for axis-aligned faces)
export const FACE_OFFSETS: readonly Vec3[] = FACE_NORMALS as Vec3[];

// Maps each face to the face pointing in the opposite direction
export const FACE_OPPOSITE: readonly FACE[] = [1, 0, 3, 2, 5, 4];

// Precomputed rotation table: kRotateFaceTable[rotation][face] = rotatedFace
// Positive rotation = CCW around +Y axis when viewed from above.
// rot=1 (90° CCW): PosX→NegZ, NegX→PosZ, PosZ→PosX, NegZ→NegX
const kRotateFaceTable: readonly (readonly FACE[])[] = [
  // rot=0: identity
  [0, 1, 2, 3, 4, 5],
  // rot=1: 90° CCW from above
  [5, 4, 2, 3, 0, 1],
  // rot=2: 180°
  [1, 0, 2, 3, 5, 4],
  // rot=3: 270° CCW (= 90° CW)
  [4, 5, 2, 3, 1, 0]
];

/**
 * Rotates a vertex position (in 0-1 block space) around the block center (0.5, 0.5, 0.5)
 * applying a Y-axis rotation and optional mirror flips.
 */
export function rotateVertex(
  vec3: Vec3,
  rotation: number,
  flip: { x: boolean; z: boolean; }
): Vec3 {
  let x = vec3[0];
  const y = vec3[1];
  let z = vec3[2];

  // Rotate around Y axis (center = 0.5)
  switch (rotation) {
    case 1: {
      const nx = z;
      const nz = 1 - x;
      x = nx; z = nz;
      break;
    }
    case 2: {
      x = 1 - x;
      z = 1 - z;
      break;
    }
    case 3: {
      const nx = 1 - z;
      const nz = x;
      x = nx; z = nz;
      break;
    }
  }

  if (flip.x) {
    x = 1 - x;
  }
  if (flip.z) {
    z = 1 - z;
  }

  return [x, y, z];
}

/**
 * Maps a block-local face direction to world-space after applying a Y-axis rotation.
 * Used by the mesh builder to find the correct neighbor to check for face culling.
 */
export function rotateFace(
  face: FACE,
  rotation: number
): FACE {
  return kRotateFaceTable[rotation & 0b11][face] as FACE;
}

export function rotateNormal(
  normal: Vec3,
  rotation: number,
  flip: { flipX: boolean; flipZ: boolean; }
): Vec3 {
  const { flipX, flipZ } = flip;

  let nx = normal[0];
  const ny = normal[1];
  let nz = normal[2];

  // Y-axis rotation (same formula as rotateVertex but without translation).
  switch (rotation) {
    case 1: {
      const t = nx;
      nx = nz; nz = -t;
      break;
    }
    case 2: {
      nx = -nx;
      nz = -nz;
      break;
    }
    case 3: {
      const t = nx;
      nx = -nz; nz = t;
      break;
    }
  }

  if (flipX) {
    nx = -nx;
  }
  if (flipZ) {
    nz = -nz;
  }

  return [nx, ny, nz];
}
