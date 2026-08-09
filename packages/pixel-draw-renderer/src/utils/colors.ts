// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import {
  clamp
} from "./math.ts";
import type {
  ColorInput,
  RGBA
} from "../types.ts";

// CONSTANTS
// Perceived brightness above which a color reads as light (0-255).
const kLightBrightness = 140;

function clamp255(
  value: number
): number {
  return clamp(Math.round(value * 255), 0, 255);
}

/**
 * Parses any valid CSS color string (hex, rgb(), hsl(), named color, ...) or
 * an existing colorjs.io `Color` instance into 0-255 RGBA components.
 * Out-of-gamut sRGB values are clamped rather than gamut-mapped.
 */
export function colorAsRGBA(
  color: ColorInput
): [number, number, number, number] {
  const srgb = new Color(
    color
  ).to("srgb");
  const [r, g, b] = srgb.coords;

  return [
    clamp255(r ?? 0),
    clamp255(g ?? 0),
    clamp255(b ?? 0),
    clamp255(srgb.alpha ?? 1)
  ];
}

export function toRGBA(
  color: RGBA | ColorInput
): RGBA {
  if (
    typeof color === "string" ||
    color instanceof Color
  ) {
    const [r, g, b, a] = colorAsRGBA(color);

    return {
      r,
      g,
      b,
      a
    };
  }

  return color;
}

/**
 * Black or white, whichever stands out against `color`. Alpha is ignored.
 */
export function contrastingColor(
  color: ColorInput
): string {
  const [r, g, b] = colorAsRGBA(color);
  // ITU-R BT.601 weights, applied to sRGB values as-is: a black-or-white
  // verdict does not warrant linearizing.
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  return brightness > kLightBrightness ?
    "#000" :
    "#FFF";
}

/**
 * Formats 0-255 RGB components as a lowercase 6-digit hex string
 * (e.g. "#1a2b3c"). Alpha is not represented.
 */
export function rgbToHex(
  r: number,
  g: number,
  b: number
): string {
  return `#${((r << 16) | (g << 8) | b)
    .toString(16)
    .padStart(6, "0")}`;
}
