// Import Internal Dependencies
import {
  hsvToRgb,
  rgbToHsv
} from "./hsv.ts";
import { clampUnit } from "../utils.ts";
import type {
  HWBA,
  RGBA
} from "../types.ts";

export function rgbToHwb(
  color: RGBA
): HWBA {
  const {
    h,
    v,
    a
  } = rgbToHsv(color);
  const min = Math.min(
    clampUnit(color.r),
    clampUnit(color.g),
    clampUnit(color.b)
  );

  return {
    h,
    w: min,
    b: 1 - v,
    a
  };
}

/**
 * Follows CSS Color 4 by collapsing `w + b >= 1` to gray.
 */
export function hwbToRgb(
  color: HWBA
): RGBA {
  const w = clampUnit(color.w);
  const b = clampUnit(color.b);
  const alpha = clampUnit(color.a);

  if (w + b >= 1) {
    const gray = w / (w + b);

    return {
      r: gray,
      g: gray,
      b: gray,
      a: alpha
    };
  }

  const value = 1 - b;

  return hsvToRgb({
    h: color.h,
    s: value === 0 ? 0 : 1 - (w / value),
    v: value,
    a: alpha
  });
}
