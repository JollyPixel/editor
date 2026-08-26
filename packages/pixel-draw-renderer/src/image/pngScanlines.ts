// Import Internal Dependencies
import { InvalidPngError } from "./errors/InvalidPngError.ts";

// CONSTANTS
const kChannelsPerColorType: Record<number, number> = {
  0: 1,
  2: 3,
  3: 1,
  4: 2,
  6: 4
};
const kGrayscale = 0;
const kIndexed = 3;
const kGrayscaleAlpha = 4;
const kTruecolorAlpha = 6;
const kOpaque = 255;

/**
 * Optional palette chunks; `alpha` holds one byte per palette entry.
 */
export interface PngPalette {
  entries: Uint8Array | null;
  alpha: Uint8Array | null;
}

/**
 * Returns undefined for color types the decoder does not implement.
 */
export function channelsPerColorType(
  colorType: number
): number | undefined {
  return kChannelsPerColorType[colorType];
}

/**
 * Reverses the per-scanline filters, dropping the leading filter byte of each
 * row. Filters reference already-unfiltered bytes, so `out` is read as it fills.
 */
export function unfilter(
  raw: Uint8Array,
  width: number,
  height: number,
  channels: number
): Uint8Array {
  const stride = width * channels;
  const out = new Uint8Array(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const from = (y * (stride + 1)) + 1;
    const to = y * stride;
    const above = to - stride;

    for (let x = 0; x < stride; x++) {
      const value = raw[from + x];
      const left = x >= channels ? out[to + x - channels] : 0;
      const up = y > 0 ? out[above + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[above + x - channels] : 0;

      switch (filter) {
        case 0:
          out[to + x] = value;
          break;
        case 1:
          out[to + x] = value + left;
          break;
        case 2:
          out[to + x] = value + up;
          break;
        case 3:
          out[to + x] = value + ((left + up) >> 1);
          break;
        case 4:
          out[to + x] = value + paeth(left, up, upLeft);
          break;
        default:
          throw new InvalidPngError(`unknown scanline filter ${filter}.`);
      }
    }
  }

  return out;
}

function paeth(
  left: number,
  up: number,
  upLeft: number
): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }

  return distanceUp <= distanceUpLeft ? up : upLeft;
}

/**
 * Expands unfiltered samples to RGBA8. Images without an alpha channel become
 * fully opaque, apart from indexed pixels covered by a tRNS table.
 */
export function toRGBA(
  scanline: Uint8Array,
  pixelCount: number,
  colorType: number,
  palette: PngPalette
): Uint8ClampedArray {
  const channels = kChannelsPerColorType[colorType];
  const pixels = new Uint8ClampedArray(pixelCount * 4);

  for (let index = 0; index < pixelCount; index++) {
    const from = index * channels;
    const to = index * 4;

    if (colorType === kIndexed) {
      writeIndexedPixel(pixels, to, scanline[from], palette);
      continue;
    }

    if (colorType === kGrayscale || colorType === kGrayscaleAlpha) {
      pixels[to] = scanline[from];
      pixels[to + 1] = scanline[from];
      pixels[to + 2] = scanline[from];
      pixels[to + 3] = colorType === kGrayscaleAlpha ?
        scanline[from + 1] :
        kOpaque;
      continue;
    }

    pixels[to] = scanline[from];
    pixels[to + 1] = scanline[from + 1];
    pixels[to + 2] = scanline[from + 2];
    pixels[to + 3] = colorType === kTruecolorAlpha ?
      scanline[from + 3] :
      kOpaque;
  }

  return pixels;
}

function writeIndexedPixel(
  pixels: Uint8ClampedArray,
  to: number,
  index: number,
  palette: PngPalette
): void {
  if (palette.entries === null) {
    throw new InvalidPngError("an indexed image has no PLTE chunk.");
  }

  const entry = index * 3;
  pixels[to] = palette.entries[entry];
  pixels[to + 1] = palette.entries[entry + 1];
  pixels[to + 2] = palette.entries[entry + 2];
  pixels[to + 3] = palette.alpha?.[index] ?? kOpaque;
}
