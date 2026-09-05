// Import Internal Dependencies
import { type Vec3, FACE } from "../../utils/math.ts";
import type { VoxelTransform } from "../../world/VoxelTransform.ts";

// CONSTANTS
// Indexed by quarter-turn then face; positive rotation is CCW from above.
// rot=1 (90° CCW):  PosX→NegZ, NegX→PosZ, PosZ→PosX, NegZ→NegX
// rot=3 (270° CCW): PosX→PosZ, NegX→NegZ, PosZ→NegX, NegZ→PosX
const kRotateFaceTable: readonly (readonly FACE[])[] = [
  [0, 1, 2, 3, 4, 5],
  [5, 4, 2, 3, 0, 1],
  [1, 0, 2, 3, 5, 4],
  [4, 5, 2, 3, 1, 0]
];

export function rotateVertex(
  vec3: Vec3,
  transform: VoxelTransform
): Vec3 {
  let x = vec3[0];
  let y = vec3[1];
  let z = vec3[2];

  switch (transform.rotation) {
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

  if (transform.flipX) {
    x = 1 - x;
  }
  if (transform.flipZ) {
    z = 1 - z;
  }
  if (transform.flipY) {
    y = 1 - y;
  }

  return [x, y, z];
}

export function rotateFace(
  face: FACE,
  rotation: number
): FACE {
  return kRotateFaceTable[rotation & 0b11][face] as FACE;
}

export function rotateNormal(
  normal: Vec3,
  transform: VoxelTransform
): Vec3 {
  let nx = normal[0];
  let ny = normal[1];
  let nz = normal[2];

  switch (transform.rotation) {
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

  if (transform.flipX) {
    nx = -nx;
  }
  if (transform.flipZ) {
    nz = -nz;
  }
  if (transform.flipY) {
    ny = -ny;
  }

  return [nx, ny, nz];
}

export function flipYFace(
  face: FACE
): FACE {
  if (face === FACE.PosY) {
    return FACE.NegY;
  }
  if (face === FACE.NegY) {
    return FACE.PosY;
  }

  return face;
}
