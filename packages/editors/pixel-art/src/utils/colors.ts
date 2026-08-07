// Import Third-party Dependencies
import type { Color } from "vanilla-picker";

export interface RgbaColor {
  hex: string;
  opacity: number;
}

/**
 * Extracts a "#rrggbb" hex color and a 0-1 opacity from a
 * vanilla-picker Color (its .hex is 8-digit "#rrggbbaa").
 */
export function fromPickerColor(
  color: Color
): RgbaColor {
  return {
    hex: color.hex.slice(0, 7),
    opacity: color.rgba[3]
  };
}

/**
 * Formats a "#rrggbb" hex color and a 0-1 opacity as an 8-digit
 * "#rrggbbaa" hex string.
 */
export function toRgbaHex(
  hex: string,
  opacity: number
): string {
  const alphaHex = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");

  return `${hex}${alphaHex}`;
}

/**
 * Formats a "#rrggbb" hex color and a 0-1 opacity as a CSS
 * "rgba(r, g, b, a)" string.
 */
export function toRgbaString(
  hex: string,
  opacity: number
): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
