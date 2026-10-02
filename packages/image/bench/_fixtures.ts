// Import Node.js Dependencies
import { deflateSync } from "node:zlib";

// Import Third-party Dependencies
import { mulberry32 } from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  writePng,
  type PngChunk
} from "../src/png/chunks.ts";
import {
  adaptiveFilter,
  filterScanlines
} from "../src/png/filters.ts";
import { writeHeader } from "../src/png/header.ts";
import {
  colorModelOf,
  type ColorModel
} from "../src/png/pixels.ts";
import type { DecodedImage } from "../src/types.ts";

// CONSTANTS
export const SIZES = [64, 256, 1024];
export const COLOR_TYPES = [
  {
    name: "grayscale",
    type: 0
  },
  {
    name: "truecolor",
    type: 2
  },
  {
    name: "indexed",
    type: 3
  },
  {
    name: "grayscale-alpha",
    type: 4
  },
  {
    name: "truecolor-alpha",
    type: 6
  }
] as const;
const kPaletteSize = 16;
const kIdatSize = 8192;

export type ColorTypeName = typeof COLOR_TYPES[number]["name"];
export type Content = "tiles" | "noise";

export function colorModel(
  type: number
): ColorModel {
  const model = colorModelOf(type);
  if (model === undefined) {
    throw new Error(`Unknown color type ${type}`);
  }

  return model;
}

export function samplesOf(
  size: number,
  type: number,
  content: Content = "tiles"
): Uint8ClampedArray {
  const { channels } = colorModel(type);
  const rng = mulberry32();
  const samples = new Uint8ClampedArray(size * size * channels);

  if (content === "noise") {
    for (let index = 0; index < samples.length; index++) {
      samples[index] = rng() * (type === 3 ? kPaletteSize : 256);
    }

    return samples;
  }

  const palette = Array.from({ length: 8 }, () => [
    Math.floor(rng() * 256),
    Math.floor(rng() * 256),
    Math.floor(rng() * 256),
    Math.floor(rng() * 256)
  ]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = ((y >> 3) * 3 + (x >> 3)) % palette.length;
      const dither = (x ^ y) & 3;
      const to = ((y * size) + x) * channels;

      if (type === 3) {
        samples[to] = tile * 2 + (dither & 1);
        continue;
      }
      for (let channel = 0; channel < channels; channel++) {
        samples[to + channel] = palette[tile][channel] +
          (channel < 2 ? dither : 0);
      }
    }
  }

  return samples;
}

export function rgbaImage(
  size: number,
  content: Content = "tiles"
): DecodedImage {
  return {
    width: size,
    height: size,
    data: samplesOf(size, 6, content)
  };
}

export function pngOf(
  size: number,
  type: number,
  content: Content = "tiles"
): Uint8Array<ArrayBuffer> {
  const color = colorModel(type);
  const compressed = deflateSync(
    filterScanlines(
      samplesOf(size, type, content),
      size,
      size,
      color.channels,
      adaptiveFilter
    )
  );

  const chunks: PngChunk[] = [
    {
      type: "IHDR",
      data: writeHeader({
        width: size,
        height: size,
        color
      })
    }
  ];
  if (type === 3) {
    const rng = mulberry32(7);
    chunks.push(
      {
        type: "PLTE",
        data: Uint8Array.from(
          { length: kPaletteSize * 3 },
          () => rng() * 256
        )
      },
      {
        type: "tRNS",
        data: Uint8Array.from(
          { length: kPaletteSize / 2 },
          () => rng() * 256
        )
      }
    );
  }
  for (let offset = 0; offset < compressed.length; offset += kIdatSize) {
    chunks.push({
      type: "IDAT",
      data: compressed.subarray(offset, offset + kIdatSize)
    });
  }

  return writePng(chunks);
}
