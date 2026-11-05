// Import Internal Dependencies
import {
  hueSector,
  rgbExtent,
  sectorChannels
} from "./sector.ts";
import { clampUnit } from "../math.ts";
import { wrapHue } from "../hue.ts";
import type {
  HSVA,
  RGBA
} from "../types.ts";

export function rgbToHsv(
  color: RGBA
): HSVA {
  const { max, chroma, hue } = rgbExtent(color);

  return {
    h: hue,
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
