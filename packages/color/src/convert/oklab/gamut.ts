// Import Internal Dependencies
import {
  oklabDistance,
  oklabToLinearRgb,
  oklabToRgb,
  rgbToOklab,
  type Lab
} from "./oklab.ts";
import { clampUnit } from "../../math.ts";
import type { RGBA } from "../../types.ts";

// CONSTANTS
const kGamutEpsilon = 1e-5;
const kJustNoticeable = 0.02;
const kSearchEpsilon = 1e-4;

export function oklabToGamutRgb(
  lab: Lab,
  alpha: number
): RGBA {
  if (lab.l >= 1 || lab.l <= 0) {
    const l = clampUnit(lab.l);

    return {
      r: l,
      g: l,
      b: l,
      a: clampUnit(alpha)
    };
  }

  if (isOklabInGamut(lab)) {
    return oklabToRgb(lab, alpha);
  }

  return mapIntoGamut(lab, alpha);
}

export function isOklabInGamut(
  lab: Lab
): boolean {
  const { r, g, b } = oklabToLinearRgb(lab);

  return (
    r >= -kGamutEpsilon && r <= 1 + kGamutEpsilon &&
    g >= -kGamutEpsilon && g <= 1 + kGamutEpsilon &&
    b >= -kGamutEpsilon && b <= 1 + kGamutEpsilon
  );
}

function mapIntoGamut(
  origin: Lab,
  alpha: number
): RGBA {
  let clipped = oklabToRgb(origin, alpha);
  if (oklabDistance(rgbToOklab(clipped), origin) < kJustNoticeable) {
    return clipped;
  }

  const chroma = Math.hypot(origin.a, origin.b);
  let min = 0;
  let max = chroma;
  let minInGamut = true;
  while (max - min > kSearchEpsilon) {
    const middle = (min + max) / 2;
    const current = scaleChroma(origin, middle / chroma);
    if (minInGamut && isOklabInGamut(current)) {
      min = middle;
      continue;
    }

    clipped = oklabToRgb(current, alpha);
    const distance = oklabDistance(rgbToOklab(clipped), current);
    if (distance >= kJustNoticeable) {
      max = middle;
    }
    else if (kJustNoticeable - distance < kSearchEpsilon) {
      return clipped;
    }
    else {
      minInGamut = false;
      min = middle;
    }
  }

  return clipped;
}

function scaleChroma(
  lab: Lab,
  scale: number
): Lab {
  return {
    l: lab.l,
    a: lab.a * scale,
    b: lab.b * scale
  };
}
