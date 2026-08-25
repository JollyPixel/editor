// Import Internal Dependencies
import { toByte } from "./convert/bytes.ts";
import { srgbToLinear } from "./convert/srgb.ts";
import { assertColor } from "./parse/index.ts";
import type {
  ColorInput,
  RGBA
} from "./types.ts";

// CONSTANTS
const kLightBrightness = 140;
const kLuminanceWeights = {
  r: 0.2126,
  g: 0.7152,
  b: 0.0722
};
const kContrastOffset = 0.05;

/**
 * Computes WCAG relative luminance and ignores alpha.
 */
export function relativeLuminance(
  color: RGBA
): number {
  return (kLuminanceWeights.r * srgbToLinear(color.r)) +
    (kLuminanceWeights.g * srgbToLinear(color.g)) +
    (kLuminanceWeights.b * srgbToLinear(color.b));
}

/**
 * Computes the WCAG contrast ratio from 1 to 21 and ignores alpha.
 */
export function contrastRatio(
  a: RGBA,
  b: RGBA
): number {
  const first = relativeLuminance(a) + kContrastOffset;
  const second = relativeLuminance(b) + kContrastOffset;

  return first > second ?
    first / second :
    second / first;
}

/**
 * Uses the editor-tuned BT.601 threshold and ignores alpha.
 */
export function contrastingColor(
  input: ColorInput
): string {
  const color = assertColor(input);
  const r = toByte(color.r);
  const g = toByte(color.g);
  const b = toByte(color.b);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  return brightness > kLightBrightness ?
    "#000" :
    "#fff";
}
