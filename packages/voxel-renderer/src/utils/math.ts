export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

// Face enum — index into FACE_NORMALS / FACE_OFFSETS / FACE_OPPOSITE
export const FACE = {
  PosX: 0,
  NegX: 1,
  PosY: 2,
  NegY: 3,
  PosZ: 4,
  NegZ: 5
} as const;
export type FACE = typeof FACE[keyof typeof FACE];

// Packs Y-axis rotation (0–3) and flip flags into a single number.
// bits 0-1: Y rotation steps (0=0°, 1=90° CCW, 2=180°, 3=270° CCW)
// bit 2: flipX (mirror around x=0.5)
// bit 3: flipZ (mirror around z=0.5)
// bit 4: flipY (mirror around y=0.5)
// eslint-disable-next-line max-params
export function packTransform(
  rotation: 0 | 1 | 2 | 3,
  flipX: boolean,
  flipZ: boolean,
  flipY = false
): number {
  return (rotation & 0b11) | (flipX ? 0b100 : 0) | (flipZ ? 0b1000 : 0) | (flipY ? 0b10000 : 0);
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
