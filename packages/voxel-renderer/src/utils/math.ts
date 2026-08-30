export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

// Face enum indexed by FACE_NORMALS / FACE_OFFSETS / FACE_OPPOSITE.
export const FACE = {
  PosX: 0,
  NegX: 1,
  PosY: 2,
  NegY: 3,
  PosZ: 4,
  NegZ: 5
} as const;
export type FACE = typeof FACE[keyof typeof FACE];

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

// Packs Y-axis rotation (0–3) and flip flags into a single number.
// bits 0-1: Y rotation steps (0=0°, 1=90° CCW, 2=180°, 3=270° CCW)
// bit 2: flipX (mirror around x=0.5)
// bit 3: flipZ (mirror around z=0.5)
// bit 4: flipY (mirror around y=0.5)
export function packTransform(
  rotation: 0 | 1 | 2 | 3,
  flipX: boolean,
  flipZ: boolean,
  flipY = false
): number {
  return (rotation & 0b11) |
    (flipX ? 0b100 : 0) |
    (flipZ ? 0b1000 : 0) |
    (flipY ? 0b10000 : 0);
}

export function unpackTransform(
  flags: number
): { rotation: 0 | 1 | 2 | 3; flipX: boolean; flipZ: boolean; flipY: boolean; } {
  return {
    rotation: (flags & 0b11) as 0 | 1 | 2 | 3,
    flipX: (flags & 0b100) !== 0,
    flipZ: (flags & 0b1000) !== 0,
    flipY: (flags & 0b10000) !== 0
  };
}

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
