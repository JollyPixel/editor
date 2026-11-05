// Import Internal Dependencies
import {
  hsvToRgb,
  rgbToHsv
} from "./hsv.ts";
import { clampUnit } from "../math.ts";
import type {
  HWBA,
  RGBA
} from "../types.ts";

export function rgbToHwb(
  color: RGBA
): HWBA {
  const {
    h,
    s,
    v,
    a
  } = rgbToHsv(color);

  return {
    h,
    w: (1 - s) * v,
    b: 1 - v,
    a
  };
}

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
    s: 1 - (w / value),
    v: value,
    a: alpha
  });
}
