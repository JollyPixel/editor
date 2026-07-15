// Import Third-party Dependencies
import Color from "colorjs.io";

// Import Internal Dependencies
import type { ColorInput, RGBA } from "./types.ts";

function clamp255(
  value: number
): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

/**
 * Parses any valid CSS color string (hex, rgb(), hsl(), named color, ...) or
 * an existing colorjs.io `Color` instance into 0-255 RGBA components.
 * Out-of-gamut sRGB values are clamped rather than gamut-mapped.
 */
export function getColorAsRGBA(
  color: ColorInput
): [number, number, number, number] {
  const srgb = new Color(color).to("srgb");
  const [r, g, b] = srgb.coords;
  const a = srgb.alpha ?? 1;

  return [clamp255(r ?? 0), clamp255(g ?? 0), clamp255(b ?? 0), clamp255(a)];
}

export function toRGBA(
  color: RGBA | ColorInput
): RGBA {
  if (typeof color === "string" || color instanceof Color) {
    const [r, g, b, a] = getColorAsRGBA(color);

    return { r, g, b, a };
  }

  return color;
}
