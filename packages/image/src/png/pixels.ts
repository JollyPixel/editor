// Import Internal Dependencies
import { InvalidPngError } from "./errors/InvalidPngError.ts";

// CONSTANTS
const kRgbaChannels = 4;
const kOpaque = 255;
const kTableSize = 256;

export interface PngPalette {
  readonly entries: Uint8Array | null;
  readonly alpha: Uint8Array | null;
}

export interface ColorModel {
  readonly type: number;
  readonly channels: number;
  toRGBA(
    samples: Uint8Array,
    palette: PngPalette
  ): Uint8ClampedArray;
}

export const TRUECOLOR_ALPHA: ColorModel = {
  type: 6,
  channels: 4,
  toRGBA: (samples) => new Uint8ClampedArray(
    samples.buffer,
    samples.byteOffset,
    samples.length
  )
};

const kColorModels: readonly ColorModel[] = [
  {
    type: 0,
    channels: 1,
    toRGBA: expandGrayscale
  },
  {
    type: 2,
    channels: 3,
    toRGBA: expandTruecolor
  },
  {
    type: 3,
    channels: 1,
    toRGBA: expandIndexed
  },
  {
    type: 4,
    channels: 2,
    toRGBA: expandGrayscaleAlpha
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
  return color.toRGBA(samples, palette);
}

function expandGrayscale(
  samples: Uint8Array
): Uint8ClampedArray {
  const table = new Uint32Array(kTableSize);
  const bytes = new Uint8Array(table.buffer);
  for (let level = 0, to = 0; level < kTableSize; level++, to += 4) {
    bytes[to] = level;
    bytes[to + 1] = level;
    bytes[to + 2] = level;
    bytes[to + 3] = kOpaque;
  }

  return expandThrough(samples, table);
}

function expandGrayscaleAlpha(
  samples: Uint8Array
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(samples.length * 2);
  for (let from = 0, to = 0; to < pixels.length; from += 2, to += 4) {
    const value = samples[from];
    pixels[to] = value;
    pixels[to + 1] = value;
    pixels[to + 2] = value;
    pixels[to + 3] = samples[from + 1];
  }

  return pixels;
}

function expandTruecolor(
  samples: Uint8Array
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray((samples.length / 3) * kRgbaChannels);
  for (let from = 0, to = 0; to < pixels.length; from += 3, to += 4) {
    pixels[to] = samples[from];
    pixels[to + 1] = samples[from + 1];
    pixels[to + 2] = samples[from + 2];
    pixels[to + 3] = kOpaque;
  }

  return pixels;
}

function expandIndexed(
  samples: Uint8Array,
  palette: PngPalette
): Uint8ClampedArray {
  const { entries, alpha } = palette;
  if (entries === null) {
    throw new InvalidPngError("an indexed image has no PLTE chunk.");
  }

  const table = new Uint32Array(kTableSize);
  const bytes = new Uint8Array(table.buffer);
  for (let index = 0, to = 0; index < kTableSize; index++, to += 4) {
    const entry = index * 3;
    bytes[to] = entries[entry] ?? 0;
    bytes[to + 1] = entries[entry + 1] ?? 0;
    bytes[to + 2] = entries[entry + 2] ?? 0;
    bytes[to + 3] = alpha?.[index] ?? kOpaque;
  }

  return expandThrough(samples, table);
}

function expandThrough(
  samples: Uint8Array,
  table: Uint32Array
): Uint8ClampedArray {
  const pixels = new Uint32Array(samples.length);
  for (let index = 0; index < samples.length; index++) {
    pixels[index] = table[samples[index]];
  }

  return new Uint8ClampedArray(pixels.buffer);
}
