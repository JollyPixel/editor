// Import Third-party Dependencies
import {
  Color,
  ColorSpace,
  type RGBA
} from "@jolly-pixel/color";
import { clamp } from "@jolly-pixel/utils";

// CONSTANTS
const kChecker = new Color({
  r: 0.8,
  g: 0.8,
  b: 0.8,
  a: 1
});
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
  light: Color;
  dark: Color;
}

export function swatchRing(
  color: RGBA
): SwatchRing {
  const base = Color.from(color).over(kChecker);
  const { l, c, h } = ColorSpace.oklch.fromRgb(base);
  const lighter = new Color(ColorSpace.oklch.toRgb({
    l: clamp(l + kLightnessShift, kLighterRange.min, kLighterRange.max),
    c,
    h,
    a: 1
  }));
  const darker = new Color(ColorSpace.oklch.toRgb({
    l: clamp(l - kLightnessShift, kDarkerRange.min, kDarkerRange.max),
    c,
    h,
    a: 1
  }));

  return {
    light: legibleRing(darker, lighter, base),
    dark: legibleRing(lighter, darker, base)
  };
}

export function formatSwatchRing(
  color: RGBA
): string {
  const { light, dark } = swatchRing(color);

  return `light-dark(${light.rgb()}, ${dark.rgb()})`;
}

function legibleRing(
  preferred: Color,
  fallback: Color,
  base: Color
): Color {
  const preferredContrast = preferred.contrastWith(base);

  return preferredContrast >= kMinContrast || preferredContrast >= fallback.contrastWith(base) ?
    preferred :
    fallback;
}
