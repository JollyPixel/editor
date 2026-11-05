// Import Internal Dependencies
import { clampUnit } from "../math.ts";
import { wrapHue } from "../hue.ts";
import type { RGBA } from "../types.ts";

// CONSTANTS
const kSector = 60;
const kAchromatic = 1e-7;

export interface RgbExtent {
  max: number;
  min: number;
  chroma: number;
  hue: number;
}

export function hueSector(
  hue: number
): number {
  return hue / kSector;
}

export function rgbExtent(
  color: RGBA
): RgbExtent {
  const r = clampUnit(color.r);
  const g = clampUnit(color.g);
  const b = clampUnit(color.b);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  if (chroma < kAchromatic) {
    return {
      max,
      min: max,
      chroma: 0,
      hue: 0
    };
  }

  return {
    max,
    min,
    chroma,
    hue: wrapHue(sectorOffset(r, g, b, max, chroma) * kSector)
  };
}

export function sectorChannels(
  sector: number,
  chroma: number,
  second: number
): [number, number, number] {
  switch (sector) {
    case 0:
      return [chroma, second, 0];
    case 1:
      return [second, chroma, 0];
    case 2:
      return [0, chroma, second];
    case 3:
      return [0, second, chroma];
    case 4:
      return [second, 0, chroma];
    default:
      return [chroma, 0, second];
  }
}

function sectorOffset(
  r: number,
  g: number,
  b: number,
  max: number,
  chroma: number
): number {
  if (max === r) {
    return ((g - b) / chroma) % 6;
  }
  if (max === g) {
    return ((b - r) / chroma) + 2;
  }

  return ((r - g) / chroma) + 4;
}
