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

/**
 * Resolves a color option that may already be a plain `RGBA` byte object
 * (used internally by PixelBuffer/CanvasBuffer) or a `ColorInput` needing
 * to be parsed.
 */
export function toRGBA(
  color: RGBA | ColorInput
): RGBA {
  if (typeof color === "string" || color instanceof Color) {
    const [r, g, b, a] = getColorAsRGBA(color);

    return { r, g, b, a };
  }

  return color;
}

/**
 * Returns a CSS-valid color string, ready to assign to a Canvas2D
 * `fillStyle`/`strokeStyle`. Strings pass through untouched (Canvas already
 * understands hex/rgb/hsl/named colors natively); `Color` instances are
 * serialized to their own color-space syntax.
 */
export function toCssColor(
  color: ColorInput
): string {
  return typeof color === "string" ? color : color.toString();
}

export function hexToRgb(
  hex: string
): { r: number; g: number; b: number; } {
  const [r, g, b] = getColorAsRGBA(hex);

  return { r, g, b };
}

export function rgbToHex(
  r: number,
  g: number,
  b: number
): string {
  if ([r, g, b].some((val) => val < 0 || val > 255)) {
    throw new Error("RGB values must be between 0 and 255.");
  }

  return new Color("srgb", [r / 255, g / 255, b / 255])
    .toString({ format: "hex", collapse: false });
}
