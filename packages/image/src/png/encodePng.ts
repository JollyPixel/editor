// Import Internal Dependencies
import { crc32 } from "./crc32.ts";
import { deflate } from "./zlib.ts";
import {
  applyFilter,
  chooseFilter,
  type FilterType
} from "./filters.ts";
import { InvalidPngError } from "../errors/InvalidPngError.ts";
import type { DecodedImage } from "../types.ts";

// CONSTANTS
const kSignature = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
]);
const kBytesPerPixel = 4;
const kBitDepth = 8;
const kColorType = 6;
const kHeaderSize = 13;
const kChunkOverhead = 12;
const kMaxDimension = 0xFFFFFFFF;

export async function encodePng(
  image: DecodedImage
): Promise<Uint8Array<ArrayBuffer>> {
  return encode(image);
}

export async function encodePngWithFilter(
  image: DecodedImage,
  filter: FilterType
): Promise<Uint8Array<ArrayBuffer>> {
  return encode(image, filter);
}

async function encode(
  image: DecodedImage,
  filter?: FilterType
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

  const expected = width * height * kBytesPerPixel;
  if (data.length !== expected) {
    throw new InvalidPngError(
      `expected ${expected} bytes for a ${width}x${height} image, ` +
      `got ${data.length}.`
    );
  }

  const compressed = await deflate(
    filterScanlines(data, width, height, filter)
  );

  return concat([
    kSignature,
    chunk("IHDR", ihdr(width, height)),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0))
  ]);
}

function filterScanlines(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  pinned: FilterType | undefined
): Uint8Array<ArrayBuffer> {
  const stride = width * kBytesPerPixel;
  const out = new Uint8Array(height * (stride + 1));

  let above: Uint8ClampedArray | null = null;
  for (let y = 0; y < height; y++) {
    const from = y * stride;
    const row = data.subarray(from, from + stride);
    const filter = pinned ?? chooseFilter(row, above, kBytesPerPixel);
    const to = y * (stride + 1);

    out[to] = filter;
    applyFilter(
      filter,
      row,
      above,
      kBytesPerPixel,
      out.subarray(to + 1, to + 1 + stride)
    );
    above = row;
  }

  return out;
}

function ihdr(
  width: number,
  height: number
): Uint8Array {
  const data = new Uint8Array(kHeaderSize);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = kBitDepth;
  data[9] = kColorType;

  return data;
}

function chunk(
  type: string,
  data: Uint8Array
): Uint8Array {
  const out = new Uint8Array(data.length + kChunkOverhead);
  const view = new DataView(out.buffer);
  const typeBytes = new Uint8Array([
    type.charCodeAt(0),
    type.charCodeAt(1),
    type.charCodeAt(2),
    type.charCodeAt(3)
  ]);

  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(data.length + 8, crc32(typeBytes, data));

  return out;
}

function concat(
  parts: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}
