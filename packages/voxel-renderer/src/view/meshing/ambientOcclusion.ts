// Import Internal Dependencies
import type { BlockVariantFace } from "./variants/types.ts";
import { FACE_AXIS } from "../../document/geometry/faceDirection.ts";

// CONSTANTS
const kLevelBits = 2;
const kLevelMask = 0b11;
const kMaxLevel = 3;
const kNormalMax = 127;
const kAoSampleMask = 0xFF;
const kAoCornersBySamples = aoCornersBySamples();

export const AO_UNOCCLUDED = 0xFF;

export function aoUAxis(
  axis: number
): number {
  return axis === 0 ? 1 : 0;
}

export function aoVAxis(
  axis: number
): number {
  return axis === 2 ? 1 : 2;
}

export function aoCornerLevel(
  side1: boolean,
  side2: boolean,
  corner: boolean
): number {
  if (side1 && side2) {
    return 0;
  }

  return kMaxLevel - (Number(side1) + Number(side2) + Number(corner));
}

export function packAoCorners(
  u0v0: number,
  u1v0: number,
  u0v1: number,
  u1v1: number
): number {
  return u0v0 |
    (u1v0 << kLevelBits) |
    (u0v1 << (kLevelBits * 2)) |
    (u1v1 << (kLevelBits * 3));
}

export function aoCornersOf(
  samples: number
): number {
  return kAoCornersBySamples[samples & kAoSampleMask];
}

function aoCornersBySamples(): Uint8Array {
  const table = new Uint8Array(kAoSampleMask + 1);
  for (let samples = 0; samples <= kAoSampleMask; samples++) {
    const [uMin, uMax, vMin, vMax, u0v0, u1v0, u0v1, u1v1] = Array.from(
      { length: 8 },
      (_, bit) => ((samples >> bit) & 1) === 1
    );
    table[samples] = packAoCorners(
      aoCornerLevel(uMin, vMin, u0v0),
      aoCornerLevel(uMax, vMin, u1v0),
      aoCornerLevel(uMin, vMax, u0v1),
      aoCornerLevel(uMax, vMax, u1v1)
    );
  }

  return table;
}

export function aoVertexByte(
  corners: number,
  u: number,
  v: number
): number {
  const u0v0 = corners & kLevelMask;
  const u1v0 = (corners >> kLevelBits) & kLevelMask;
  const u0v1 = (corners >> (kLevelBits * 2)) & kLevelMask;
  const u1v1 = (corners >> (kLevelBits * 3)) & kLevelMask;
  const level = ((1 - u) * (1 - v) * u0v0) +
    (u * (1 - v) * u1v0) +
    ((1 - u) * v * u0v1) +
    (u * v * u1v1);

  return Math.round(level * kNormalMax / kMaxLevel);
}

export function shadeFace(
  face: Pick<BlockVariantFace, "cull" | "positions" | "vertexCount">,
  ao: number,
  shade: Int8Array
): number {
  if (ao === AO_UNOCCLUDED || face.cull < 0) {
    shade.fill(kNormalMax);

    return 0;
  }

  const axis = FACE_AXIS[face.cull];
  const uAxis = aoUAxis(axis);
  const vAxis = aoVAxis(axis);
  const local = face.positions;
  const last = face.vertexCount - 1;
  for (let i = 0; i < 4; i++) {
    const i3 = (i > last ? last : i) * 3;
    shade[i] = aoVertexByte(ao, local[i3 + uAxis], local[i3 + vAxis]);
  }

  return face.vertexCount === 4 && shade[0] + shade[2] < shade[1] + shade[3] ?
    1 :
    0;
}
