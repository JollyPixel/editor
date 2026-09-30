// Import Internal Dependencies
import { InvalidPngError } from "./errors/InvalidPngError.ts";

// CONSTANTS
const kRgbaChannels = 4;
const kOpaque = 255;

export interface PngPalette {
  readonly entries: Uint8Array | null;
  readonly alpha: Uint8Array | null;
}

export interface ColorModel {
  readonly type: number;
  readonly channels: number;
  expand(
    samples: Uint8Array,
    pixels: Uint8ClampedArray,
    palette: PngPalette
  ): void;
}

export const TRUECOLOR_ALPHA: ColorModel = {
  type: 6,
  channels: 4,
  expand: (samples, pixels) => pixels.set(samples)
};

const kColorModels: readonly ColorModel[] = [
  {
    type: 0,
    channels: 1,
    expand: expandGrayscale
  },
  {
    type: 2,
    channels: 3,
    expand: expandTruecolor
  },
  {
    type: 3,
    channels: 1,
    expand: expandIndexed
  },
  {
    type: 4,
    channels: 2,
    expand: expandGrayscaleAlpha
  },
  TRUECOLOR_ALPHA
];

export function colorModelOf(
  type: number
): ColorModel | undefined {
  return kColorModels.find((model) => model.type === type);
}

export function toRGBA(
  samples: Uint8Array,
  color: ColorModel,
  palette: PngPalette
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(
    (samples.length / color.channels) * kRgbaChannels
  );
  color.expand(samples, pixels, palette);

  return pixels;
}

function expandGrayscale(
  samples: Uint8Array,
  pixels: Uint8ClampedArray
): void {
  for (let from = 0, to = 0; to < pixels.length; from++, to += 4) {
    const value = samples[from];
    pixels[to] = value;
    pixels[to + 1] = value;
    pixels[to + 2] = value;
    pixels[to + 3] = kOpaque;
  }
}

function expandGrayscaleAlpha(
  samples: Uint8Array,
  pixels: Uint8ClampedArray
): void {
  for (let from = 0, to = 0; to < pixels.length; from += 2, to += 4) {
    const value = samples[from];
    pixels[to] = value;
    pixels[to + 1] = value;
    pixels[to + 2] = value;
    pixels[to + 3] = samples[from + 1];
  }
}

function expandTruecolor(
  samples: Uint8Array,
  pixels: Uint8ClampedArray
): void {
  for (let from = 0, to = 0; to < pixels.length; from += 3, to += 4) {
    pixels[to] = samples[from];
    pixels[to + 1] = samples[from + 1];
    pixels[to + 2] = samples[from + 2];
    pixels[to + 3] = kOpaque;
  }
}

function expandIndexed(
  samples: Uint8Array,
  pixels: Uint8ClampedArray,
  palette: PngPalette
): void {
  const { entries, alpha } = palette;
  if (entries === null) {
    throw new InvalidPngError("an indexed image has no PLTE chunk.");
  }

  for (let from = 0, to = 0; to < pixels.length; from++, to += 4) {
    const index = samples[from];
    const entry = index * 3;
    pixels[to] = entries[entry];
    pixels[to + 1] = entries[entry + 1];
    pixels[to + 2] = entries[entry + 2];
    pixels[to + 3] = alpha?.[index] ?? kOpaque;
  }
}
