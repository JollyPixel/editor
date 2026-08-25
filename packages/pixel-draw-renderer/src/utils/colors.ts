// Import Third-party Dependencies
import {
  assertColor,
  formatRgba,
  fromRGBA8,
  toRGBA8,
  type RGBA
} from "@jolly-pixel/color";

// Import Internal Dependencies
import type {
  ByteColorInput,
  RGBA8
} from "../types.ts";

export function resolveColor(
  color: ByteColorInput
): RGBA8 {
  if (typeof color !== "string") {
    return color;
  }

  return toRGBA8(assertColor(color));
}

export function toUnitColor(
  color: ByteColorInput
): RGBA {
  return typeof color === "string" ?
    assertColor(color) :
    fromRGBA8(color);
}

export function toCssColor(
  color: ByteColorInput
): string {
  return formatRgba(toUnitColor(color));
}
