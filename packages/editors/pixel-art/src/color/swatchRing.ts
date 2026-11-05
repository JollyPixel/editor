// Import Third-party Dependencies
import {
  ColorSpace,
  formatRgb,
  srgbToLinear,
  type RGBA
} from "@jolly-pixel/color";

// CONSTANTS
const kCheckerAverage = 0.8;
const kMinContrast = 3;
const kLightnessShift = 0.45;
const kLighterRange = {
  min: 0.85,
  max: 0.97
};
const kDarkerRange = {
  min: 0.18,
  max: 0.35
};

export interface SwatchRing {
  light: RGBA;
  dark: RGBA;
}

export function swatchRing(
  color: RGBA
): SwatchRing {
  const base = overChecker(color);
  const { l, c, h } = ColorSpace.oklch.fromRgb(base);
  const lighter = ColorSpace.oklch.toRgb({
    l: clamp(l + kLightnessShift, kLighterRange),
    c,
    h,
    a: 1
  });
  const darker = ColorSpace.oklch.toRgb({
    l: clamp(l - kLightnessShift, kDarkerRange),
    c,
    h,
    a: 1
  });

  return {
    light: legibleRing(darker, lighter, base),
    dark: legibleRing(lighter, darker, base)
  };
}

export function formatSwatchRing(
  color: RGBA
): string {
  const { light, dark } = swatchRing(color);

  return `light-dark(${formatRgb(light)}, ${formatRgb(dark)})`;
}

function overChecker(
  color: RGBA
): RGBA {
  return {
    r: mixOverChecker(color.r, color.a),
    g: mixOverChecker(color.g, color.a),
    b: mixOverChecker(color.b, color.a),
    a: 1
  };
}

function mixOverChecker(
  channel: number,
  alpha: number
): number {
  return (channel * alpha) + (kCheckerAverage * (1 - alpha));
}

function legibleRing(
  preferred: RGBA,
  fallback: RGBA,
  base: RGBA
): RGBA {
  const preferredContrast = contrastRatio(preferred, base);

  return preferredContrast >= kMinContrast || preferredContrast >= contrastRatio(fallback, base) ?
    preferred :
    fallback;
}

function contrastRatio(
  first: RGBA,
  second: RGBA
): number {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);

  return (high + 0.05) / (low + 0.05);
}

function luminance(
  color: RGBA
): number {
  return (0.2126 * srgbToLinear(color.r)) +
    (0.7152 * srgbToLinear(color.g)) +
    (0.0722 * srgbToLinear(color.b));
}

function clamp(
  value: number,
  range: { min: number; max: number; }
): number {
  return Math.min(range.max, Math.max(range.min, value));
}
