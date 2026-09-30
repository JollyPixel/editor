// Import Internal Dependencies
import { writePng } from "./chunks.ts";
import { writeHeader } from "./header.ts";
import {
  adaptiveFilter,
  filterScanlines,
  type FilterStrategy
} from "./filters.ts";
import { TRUECOLOR_ALPHA } from "./pixels.ts";
import { deflate } from "./zlib.ts";
import { InvalidPngError } from "./errors/InvalidPngError.ts";
import type { DecodedImage } from "../types.ts";

// CONSTANTS
const kMaxDimension = 0xFFFFFFFF;

export function encodePng(
  image: DecodedImage
): Promise<Uint8Array<ArrayBuffer>> {
  return encodePngWith(image, adaptiveFilter);
}

export async function encodePngWith(
  image: DecodedImage,
  strategy: FilterStrategy
): Promise<Uint8Array<ArrayBuffer>> {
  const { width, height, data } = image;

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > kMaxDimension ||
    height > kMaxDimension
  ) {
    throw new InvalidPngError(
      "dimensions must be positive 32-bit integers, " +
      `got ${width}x${height}.`
    );
  }

  const expected = width * height * TRUECOLOR_ALPHA.channels;
  if (data.length !== expected) {
    throw new InvalidPngError(
      `expected ${expected} bytes for a ${width}x${height} image, ` +
      `got ${data.length}.`
    );
  }

  const compressed = await deflate(
    filterScanlines(
      data,
      width,
      height,
      TRUECOLOR_ALPHA.channels,
      strategy
    )
  );

  return writePng([
    {
      type: "IHDR",
      data: writeHeader({
        width,
        height,
        color: TRUECOLOR_ALPHA
      })
    },
    {
      type: "IDAT",
      data: compressed
    }
  ]);
}
