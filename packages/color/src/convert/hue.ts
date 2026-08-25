// Import Internal Dependencies
import { wrapHue } from "../utils.ts";

// CONSTANTS
const kSector = 60;

export function hueSector(
  hue: number
): number {
  return hue / kSector;
}

export function hueOf(
  r: number,
  g: number,
  b: number,
  max: number,
  chroma: number
): number {
  if (chroma === 0) {
    return 0;
  }

  return wrapHue(sectorOffset(r, g, b, max, chroma) * kSector);
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
