// Import Internal Dependencies
import {
  clamp,
  BYTE_MAX
} from "../utils.ts";
import type {
  RGBA,
  RGBA8
} from "../types.ts";

/**
 * Rounds and clamps unit channels to bytes.
 */
export function toRGBA8(
  color: RGBA
): RGBA8 {
  return {
    r: toByte(color.r),
    g: toByte(color.g),
    b: toByte(color.b),
    a: toByte(color.a)
  };
}

/**
 * Divides byte channels by 255 without validation.
 */
export function fromRGBA8(
  color: RGBA8
): RGBA {
  return {
    r: color.r / BYTE_MAX,
    g: color.g / BYTE_MAX,
    b: color.b / BYTE_MAX,
    a: color.a / BYTE_MAX
  };
}

export function toByte(
  channel: number
): number {
  return clamp(
    Math.round(channel * BYTE_MAX),
    0,
    BYTE_MAX
  );
}
