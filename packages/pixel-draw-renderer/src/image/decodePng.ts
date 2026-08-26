// Import Internal Dependencies
import { inflate } from "./inflate.ts";
import {
  channelsPerColorType,
  toRGBA,
  unfilter,
  type PngPalette
} from "./pngScanlines.ts";
import { InvalidPngError } from "./errors/InvalidPngError.ts";

// CONSTANTS
const kSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
// Length plus type, followed by the payload and a four-byte CRC.
const kChunkHeaderSize = 8;
const kCrcSize = 4;
const kHeaderSize = 13;
const kSupportedBitDepth = 8;

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA8, row-major from the top-left corner. */
  pixels: Uint8ClampedArray;
}

/**
 * Decodes 8-bit, non-interlaced PNG images to exact RGBA8 samples, with no
 * color management applied. Chunk CRCs are not verified.
 *
 * Both the seed pipeline, which runs before any browser exists, and the
 * browsers that lack `ImageDecoder` go through this decoder.
 */
export async function decodePng(
  data: Uint8Array
): Promise<DecodedPng> {
  assertSignature(data);

  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength
  );
  const palette: PngPalette = {
    entries: null,
    alpha: null
  };
  const idat: Uint8Array[] = [];
  let header: PngHeader | null = null;

  let offset = kSignature.length;
  while (offset + kChunkHeaderSize <= data.length) {
    const length = view.getUint32(offset);
    const type = readChunkType(data, offset + 4);
    const start = offset + kChunkHeaderSize;
    const chunk = data.subarray(start, start + length);
    offset = start + length + kCrcSize;

    if (type === "IHDR") {
      header = readHeader(chunk);
    }
    else if (type === "PLTE") {
      palette.entries = chunk;
    }
    else if (type === "tRNS") {
      palette.alpha = chunk;
    }
    else if (type === "IDAT") {
      idat.push(chunk);
    }
    else if (type === "IEND") {
      break;
    }
  }

  if (header === null) {
    throw new InvalidPngError("the image has no IHDR chunk.");
  }

  const { width, height, colorType, channels } = header;
  const scanline = unfilter(
    await inflate(concat(idat)),
    width,
    height,
    channels
  );

  return {
    width,
    height,
    pixels: toRGBA(scanline, width * height, colorType, palette)
  };
}

interface PngHeader {
  width: number;
  height: number;
  colorType: number;
  channels: number;
}

function assertSignature(
  data: Uint8Array
): void {
  for (let i = 0; i < kSignature.length; i++) {
    if (data[i] !== kSignature[i]) {
      throw new InvalidPngError("payload is not a PNG.");
    }
  }
}

function readChunkType(
  data: Uint8Array,
  offset: number
): string {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3]
  );
}

function readHeader(
  chunk: Uint8Array
): PngHeader {
  if (chunk.length < kHeaderSize) {
    throw new InvalidPngError("the IHDR chunk is truncated.");
  }

  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const bitDepth = chunk[8];
  const colorType = chunk[9];
  const interlace = chunk[12];

  if (bitDepth !== kSupportedBitDepth) {
    throw new InvalidPngError(
      `only 8-bit images are supported, got ${bitDepth}-bit.`
    );
  }
  if (interlace !== 0) {
    throw new InvalidPngError("interlaced images are not supported.");
  }
  const channels = channelsPerColorType(colorType);
  if (channels === undefined) {
    throw new InvalidPngError(`unsupported color type ${colorType}.`);
  }

  return {
    width,
    height,
    colorType,
    channels
  };
}

function concat(
  chunks: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const chunk of chunks) {
    total += chunk.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}
