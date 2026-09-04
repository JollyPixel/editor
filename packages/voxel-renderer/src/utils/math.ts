export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

// Face enum indexed by every FACE_* table below.
export const FACE = {
  PosX: 0,
  NegX: 1,
  PosY: 2,
  NegY: 3,
  PosZ: 4,
  NegZ: 5
} as const;
export type FACE = typeof FACE[keyof typeof FACE];

/**
 * Every face in `FACE` order, for code that walks all six directions.
 */
export const FACES: readonly FACE[] = [
  FACE.PosX,
  FACE.NegX,
  FACE.PosY,
  FACE.NegY,
  FACE.PosZ,
  FACE.NegZ
];

// Axis each face is perpendicular to (0 = x, 1 = y, 2 = z).
export const FACE_AXIS: readonly number[] = [0, 0, 1, 1, 2, 2];

// True for a face pointing along the positive side of its axis.
export const FACE_POSITIVE: readonly boolean[] = [
  true,
  false,
  true,
  false,
  true,
  false
];

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
export const FACE_OFFSETS: readonly Vec3[] = FACE_NORMALS;

// Maps each face to the face pointing in the opposite direction
export const FACE_OPPOSITE: readonly FACE[] = [1, 0, 3, 2, 5, 4];

export function clamp(
  min: number,
  max: number,
  value: number
): number {
  return Math.min(max, Math.max(min, value));
}

export function isPowerOfTwo(
  value: number
): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

/**
 * Enforces power-of-two chunk sizes required by shift-and-mask indexing.
 */
export function assertPowerOfTwoChunkSize(
  value: number,
  origin: string
): void {
  if (!isPowerOfTwo(value)) {
    throw new RangeError(
      `${origin}: chunkSize must be a power of two, received ${value}.`
    );
  }
}
