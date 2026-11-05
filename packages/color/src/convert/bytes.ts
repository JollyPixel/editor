// Import Internal Dependencies
import {
  clamp,
  BYTE_MAX
} from "../math.ts";
import type { RGBA8 } from "../types.ts";

// CONSTANTS
const kChannels = ["r", "g", "b", "a"] as const;

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

export function equalRGBA8(
  left: RGBA8,
  right: RGBA8
): boolean {
  return left.r === right.r &&
    left.g === right.g &&
    left.b === right.b &&
    left.a === right.a;
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
