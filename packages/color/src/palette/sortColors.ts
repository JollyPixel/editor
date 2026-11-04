// Import Internal Dependencies
import { rgbToOklch } from "../convert/oklab/oklch.ts";
import type {
  OKLCHA,
  RGBA
} from "../types.ts";

// CONSTANTS
const kGrayChroma = 0.02;

export type ColorSortKey = "hue" | "chroma" | "lightness" | "alpha";

type Compare = (left: OKLCHA, right: OKLCHA) => number;

const kCompare: Record<ColorSortKey, Compare> = {
  hue: (left, right) => {
    const leftGray = left.c < kGrayChroma;
    const rightGray = right.c < kGrayChroma;
    if (leftGray !== rightGray) {
      return leftGray ? -1 : 1;
    }

    return leftGray || left.h === right.h ?
      left.l - right.l :
      left.h - right.h;
  },
  chroma: (left, right) => left.c - right.c,
  lightness: (left, right) => left.l - right.l,
  alpha: (left, right) => left.a - right.a
};

export function sortColors(
  colors: readonly RGBA[],
  key: ColorSortKey
): RGBA[] {
  const compare = kCompare[key];

  return colors
    .map((color) => {
      return {
        color,
        lch: rgbToOklch(color)
      };
    })
    .sort((left, right) => compare(left.lch, right.lch))
    .map((entry) => entry.color);
}
