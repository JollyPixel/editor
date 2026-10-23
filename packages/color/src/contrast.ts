// Import Internal Dependencies
import { srgbToLinear } from "./convert/srgb.ts";
import { clampUnit } from "./math.ts";
import { assertColor } from "./parse/index.ts";
import type {
  ColorInput,
  RGBA
} from "./types.ts";

// CONSTANTS
const kLuminanceWeights = {
  r: 0.2126,
  g: 0.7152,
  b: 0.0722
};
const kContrastOffset = 0.05;
const kWhiteLuminance = 1;

export function contrastingColor(
  input: ColorInput
): "#000" | "#fff" {
  const luminance = relativeLuminance(assertColor(input));
  const onBlack = (luminance + kContrastOffset) / kContrastOffset;
  const onWhite = (kWhiteLuminance + kContrastOffset) /
    (luminance + kContrastOffset);

  return onBlack >= onWhite ?
    "#000" :
    "#fff";
}

function relativeLuminance(
  color: RGBA
): number {
  return (kLuminanceWeights.r * srgbToLinear(clampUnit(color.r))) +
    (kLuminanceWeights.g * srgbToLinear(clampUnit(color.g))) +
    (kLuminanceWeights.b * srgbToLinear(clampUnit(color.b)));
}
