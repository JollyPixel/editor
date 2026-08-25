// Import Internal Dependencies
import { hslToRgb } from "../convert/hsl.ts";
import { formatHex } from "../format.ts";

// CONSTANTS
const kDefaultColors = [
  "#f94144",
  "#f3722c",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1"
];
const kGoldenAngle = 137.5;
/**
 * These defaults keep peer markers legible on dark scenes.
 */
const kDefaultLightness = 0.7;
const kDefaultSaturation = 0.72;

export interface GoldenAngleOptions {
  /**
   * @default 0.72
   */
  saturation?: number;
  /**
   * @default 0.7
   */
  lightness?: number;
}

export function defaultPaletteColors(): string[] {
  return [...kDefaultColors];
}

/**
 * Returns the stable palette-index hash used by `colorFromKey`.
 */
export function hashKey(
  key: string
): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash * 31) + key.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

export function colorFromKey(
  key: string,
  colors: readonly string[] = kDefaultColors
): string {
  return colors[hashKey(key) % colors.length];
}

/**
 * Generates unbounded colors with adjacent hues 137.5 degrees apart.
 */
export function goldenAngleColor(
  index: number,
  options: GoldenAngleOptions = {}
): string {
  const {
    saturation = kDefaultSaturation,
    lightness = kDefaultLightness
  } = options;

  return formatHex(
    hslToRgb({
      h: index * kGoldenAngle,
      s: saturation,
      l: lightness,
      a: 1
    })
  );
}
