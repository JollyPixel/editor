// Import Internal Dependencies
import {
  hueOf,
  hueSector,
  sectorChannels
} from "./hue.ts";
import {
  clampUnit,
  wrapHue
} from "../utils.ts";
import type {
  HSLA,
  RGBA
} from "../types.ts";

/**
 * Clamps unit sRGB and reports zero hue and saturation for grays.
 */
export function rgbToHsl(
  color: RGBA
): HSLA {
  const r = clampUnit(color.r);
  const g = clampUnit(color.g);
  const b = clampUnit(color.b);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lightness = (max + min) / 2;

  return {
    h: hueOf(r, g, b, max, chroma),
    s: saturationOf(chroma, lightness),
    l: lightness,
    a: clampUnit(color.a)
  };
}

/**
 * Wraps hue and clamps all other HSLA channels.
 */
export function hslToRgb(
  color: HSLA
): RGBA {
  const h = wrapHue(color.h);
  const s = clampUnit(color.s);
  const l = clampUnit(color.l);

  const chroma = (1 - Math.abs((2 * l) - 1)) * s;
  const sector = hueSector(h);
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = l - (chroma / 2);

  const [
    r,
    g,
    b
  ] = sectorChannels(
    Math.floor(sector) % 6,
    chroma,
    second
  );

  return {
    r: r + base,
    g: g + base,
    b: b + base,
    a: clampUnit(color.a)
  };
}

function saturationOf(
  chroma: number,
  lightness: number
): number {
  if (chroma === 0) {
    return 0;
  }

  return chroma / (1 - Math.abs((2 * lightness) - 1));
}
