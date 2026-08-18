export interface RgbaColor {
  hex: string;
  opacity: number;
}

/**
 * Splits an 8-digit "#rrggbbaa" hex string into a "#rrggbb" hex
 * color and a 0-1 opacity.
 */
export function splitRgbaHex(
  hex8: string
): RgbaColor {
  return {
    hex: hex8.slice(0, 7),
    opacity: parseInt(hex8.slice(7, 9), 16) / 255
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
