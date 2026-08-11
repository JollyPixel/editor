// Import Internal Dependencies
import type {
  HSVA,
  RGBA
} from "./types.ts";

// CONSTANTS
const kSector = 60;
const kTurn = 360;

/**
 * Converts RGBA channels to HSVA. Achromatic colours use zero hue and saturation.
 */
export function rgbToHsv(
  color: RGBA
): HSVA {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  return {
    h: hueOf(r, g, b, max, chroma),
    s: max === 0 ? 0 : chroma / max,
    v: max,
    a: color.a
  };
}

/**
 * Converts HSVA to RGBA with wrapped hue and clamped unit channels.
 */
export function hsvToRgb(
  color: HSVA
): RGBA {
  const h = wrapHue(color.h);
  const s = clampUnit(color.s);
  const v = clampUnit(color.v);

  const chroma = v * s;
  const sector = h / kSector;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = v - chroma;

  const [
    r,
    g,
    b
  ] = channelsOf(
    Math.floor(sector) % 6,
    chroma,
    second
  );

  return {
    r: (r + base) * 255,
    g: (g + base) * 255,
    b: (b + base) * 255,
    a: clampUnit(color.a)
  };
}

function hueOf(
  r: number,
  g: number,
  b: number,
  max: number,
  chroma: number
): number {
  if (chroma === 0) {
    return 0;
  }

  const offset = pickOffset(r, g, b, max, chroma);

  return wrapHue(offset * kSector);
}

function pickOffset(
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

function channelsOf(
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

function wrapHue(
  hue: number
): number {
  return ((hue % kTurn) + kTurn) % kTurn;
}

function clampUnit(
  value: number
): number {
  return Math.min(
    1,
    Math.max(0, value)
  );
}
