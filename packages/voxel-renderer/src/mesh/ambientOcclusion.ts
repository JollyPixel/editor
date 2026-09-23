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

/**
 * Packed corner levels of a face with no occluder: every corner at level 3.
 */
export const AO_UNOCCLUDED = 0xFF;

/**
 * First in-plane axis of a face perpendicular to `axis`.
 */
export function aoUAxis(
  axis: number
): number {
  return axis === 0 ? 1 : 0;
}

/**
 * Second in-plane axis of a face perpendicular to `axis`.
 */
export function aoVAxis(
  axis: number
): number {
  return axis === 2 ? 1 : 2;
}

/**
 * Brightness level of one face corner from its three in-plane neighbours,
 * 0 (darkest) to 3 (unoccluded). Two occluding sides fully darken the corner.
 */
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

/**
 * Packs four corner levels, indexed by `u + (2 * v)` over the face's
 * in-plane axes, into one byte.
 */
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

/**
 * Bilinear brightness at in-plane position `(u, v)` in 0-1 face space, as the
 * signed-normalized byte stored in the normal attribute's `w`.
 */
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

/**
 * Shared shading uniform: 0 leaves faces untouched, 1 turns a fully occluded
 * corner black.
 */
export function createAoStrength(
  strength = 0
) {
  return uniform(strength);
}

export type AoStrengthUniform = ReturnType<typeof createAoStrength>;

/**
 * Albedo multiplier read from the chunk normal attribute's `w`.
 */
export function aoFactorNode(
  strength: AoStrengthUniform
) {
  const brightness = attribute<"vec4">("normal", "vec4").w;

  return float(1).sub(strength.mul(float(1).sub(brightness)));
}
