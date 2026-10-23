// Import Internal Dependencies
import type { ColorFunction } from "./arguments.ts";
import {
  parseAlpha,
  parseHue,
  parseScaledNumber
} from "./tokens.ts";
import { oklabToGamutRgb } from "../convert/oklab/gamut.ts";
import { oklchToRgb } from "../convert/oklab/oklch.ts";
import { clampUnit } from "../math.ts";
import type { RGBA } from "../types.ts";

// CONSTANTS
const kChromaPercent = 0.4;

export function parseOklchFunction(
  fn: ColorFunction
): RGBA | null {
  if (fn.legacy) {
    return null;
  }

  const [
    lightness,
    chroma,
    hue
  ] = fn.args;
  const l = parseScaledNumber(lightness, 1);
  const c = parseScaledNumber(chroma, kChromaPercent);
  const h = parseHue(hue);
  const a = parseAlpha(fn.alpha);
  if (
    l === null ||
    c === null ||
    h === null ||
    a === null
  ) {
    return null;
  }

  return oklchToRgb({
    l,
    c,
    h,
    a
  });
}

export function parseOklabFunction(
  fn: ColorFunction
): RGBA | null {
  if (fn.legacy) {
    return null;
  }

  const [
    lightness,
    first,
    second
  ] = fn.args;
  const l = parseScaledNumber(lightness, 1);
  const a = parseScaledNumber(first, kChromaPercent);
  const b = parseScaledNumber(second, kChromaPercent);
  const alpha = parseAlpha(fn.alpha);
  if (
    l === null ||
    a === null ||
    b === null ||
    alpha === null
  ) {
    return null;
  }

  return oklabToGamutRgb(
    {
      l: clampUnit(l),
      a,
      b
    },
    alpha
  );
}
