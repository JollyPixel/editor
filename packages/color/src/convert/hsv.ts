// Import Internal Dependencies
import {
  computeHue,
  hueSector,
  sectorChannels
} from "./hue.ts";
import {
  clampUnit,
  wrapHue
} from "../math.ts";
import type {
  HSVA,
  RGBA
} from "../types.ts";

export function rgbToHsv(
  color: RGBA
): HSVA {
  const r = clampUnit(color.r);
  const g = clampUnit(color.g);
  const b = clampUnit(color.b);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  return {
    h: computeHue(r, g, b, max, chroma),
    s: max === 0 ? 0 : chroma / max,
    v: max,
    a: clampUnit(color.a)
  };
}

export function hsvToRgb(
  color: HSVA
): RGBA {
  const h = wrapHue(color.h);
  const s = clampUnit(color.s);
  const v = clampUnit(color.v);

  const chroma = v * s;
  const sector = hueSector(h);
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = v - chroma;

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
