// Import Third-party Dependencies
import {
  attribute,
  float,
  uniform
} from "three/tsl";

// CONSTANTS
const kLevelBits = 2;
const kLevelMask = 0b11;
const kMaxLevel = 3;
const kNormalMax = 127;

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

export function createAoStrength(
  strength = 0
) {
  return uniform(strength);
}

export type AoStrengthUniform = ReturnType<typeof createAoStrength>;

export function aoFactorNode(
  strength: AoStrengthUniform
) {
  const brightness = attribute<"vec4">("normal", "vec4").w;

  return float(1).sub(strength.mul(float(1).sub(brightness)));
}
