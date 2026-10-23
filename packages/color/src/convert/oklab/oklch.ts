// Import Internal Dependencies
import {
  isOklabInGamut,
  oklabToGamutRgb
} from "./gamut.ts";
import {
  hueDirection,
  oklabPolar,
  rgbToOklab,
  type Lab
} from "./oklab.ts";
import { clampUnit } from "../../math.ts";
import type {
  OKLCHA,
  RGBA
} from "../../types.ts";

export function rgbToOklch(
  color: RGBA
): OKLCHA {
  const lab = rgbToOklab(color);
  const { c, h } = oklabPolar(lab);

  return {
    l: lab.l,
    c,
    h,
    a: clampUnit(color.a)
  };
}

export function oklchToRgb(
  color: OKLCHA
): RGBA {
  return oklabToGamutRgb(
    toLab({
      ...color,
      l: clampUnit(color.l)
    }),
    color.a
  );
}

export function isOklchInGamut(
  color: OKLCHA
): boolean {
  return isOklabInGamut(toLab(color));
}

function toLab(
  color: OKLCHA
): Lab {
  const chroma = Math.max(color.c, 0);
  const { a, b } = hueDirection(color.h);

  return {
    l: color.l,
    a: chroma * a,
    b: chroma * b
  };
}
