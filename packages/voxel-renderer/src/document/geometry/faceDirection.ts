export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export const FACE = {
  PosX: 0,
  NegX: 1,
  PosY: 2,
  NegY: 3,
  PosZ: 4,
  NegZ: 5
} as const;
export type FACE = typeof FACE[keyof typeof FACE];

export const FACES: readonly FACE[] = [
  FACE.PosX,
  FACE.NegX,
  FACE.PosY,
  FACE.NegY,
  FACE.PosZ,
  FACE.NegZ
];

export const FACE_AXIS: readonly number[] = [0, 0, 1, 1, 2, 2];

export const FACE_POSITIVE: readonly boolean[] = [
  true,
  false,
  true,
  false,
  true,
  false
];

export const FACE_NORMALS: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

export const FACE_OFFSETS: readonly Vec3[] = FACE_NORMALS;

export const FACE_OPPOSITE: readonly FACE[] = [1, 0, 3, 2, 5, 4];
