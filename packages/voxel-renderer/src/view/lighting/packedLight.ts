// CONSTANTS
const kChannelBits = 4;
const kChannelMask = (1 << kChannelBits) - 1;
const kRedMask = kChannelMask << (kChannelBits * 2);
const kGreenMask = kChannelMask << kChannelBits;
const kBlueMask = kChannelMask;
const kLowBits = (1 << (kChannelBits * 2)) | (1 << kChannelBits) | 1;

export const PACKED_LIGHT_MASK = kRedMask | kGreenMask | kBlueMask;
export const LIGHT_OPAQUE = PACKED_LIGHT_MASK + 1;

export function packLight(
  red: number,
  green: number,
  blue: number
): number {
  return (red << (kChannelBits * 2)) | (green << kChannelBits) | blue;
}

export function grayLight(
  level: number
): number {
  return packLight(level, level, level);
}

export function lightChannel(
  light: number,
  channel: 0 | 1 | 2
): number {
  return (light >> (kChannelBits * (2 - channel))) & kChannelMask;
}

export function dimLight(
  light: number
): number {
  const lit = (light | (light >> 1) | (light >> 2) | (light >> 3)) & kLowBits;

  return light - lit;
}

export function brightestLight(
  a: number,
  b: number
): number {
  return Math.max(a & kRedMask, b & kRedMask) |
    Math.max(a & kGreenMask, b & kGreenMask) |
    Math.max(a & kBlueMask, b & kBlueMask);
}
