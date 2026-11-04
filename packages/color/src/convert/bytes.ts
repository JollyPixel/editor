// Import Internal Dependencies
import {
  clamp,
  BYTE_MAX
} from "../math.ts";
import type {
  RGBA,
  RGBA8
} from "../types.ts";

// CONSTANTS
const kChannels = ["r", "g", "b", "a"] as const;

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

export function isRGBA8(
  value: unknown
): value is RGBA8 {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return kChannels.every((key) => isByte(Reflect.get(value, key)));
}

function isByte(
  value: unknown
): boolean {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= BYTE_MAX;
}

export function toByte(
  channel: number
): number {
  return clampByte(channel * BYTE_MAX);
}

export function clampByte(
  value: number
): number {
  return clamp(
    Math.round(value),
    0,
    BYTE_MAX
  );
}
