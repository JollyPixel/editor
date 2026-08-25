// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";

// CONSTANTS
const kSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const kChannelsPerColorType: Record<number, number> = {
  0: 1,
  2: 3,
  3: 1,
  4: 2,
  6: 4
};

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA8, row-major from the top-left corner. */
  pixels: Uint8ClampedArray;
}

/**
 * Minimal PNG reader for the seed pipeline: 8-bit, non-interlaced images.
 * Node has no image decoder and the seed runs before a browser exists.
 */
export function decodePng(
  data: Uint8Array
): DecodedPng {
  const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < kSignature.length; i++) {
    if (bytes[i] !== kSignature[i]) {
      throw new Error("decodePng: payload is not a PNG.");
    }
  }

  let header: PngHeader | null = null;
  const palette: PngPalette = { entries: null, alpha: null };
  const idat: Buffer[] = [];

  let offset = kSignature.length;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const chunk = bytes.subarray(start, start + length);
    offset = start + length + 4;

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
    throw new Error("decodePng: the image has no IHDR chunk.");
  }

  const { width, height, colorType } = header;
  const channels = kChannelsPerColorType[colorType];
  const scanline = unfilter(
    inflateSync(Buffer.concat(idat)),
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

interface PngPalette {
  entries: Buffer | null;
  alpha: Buffer | null;
}

interface PngHeader {
  width: number;
  height: number;
  colorType: number;
}

function readHeader(
  chunk: Buffer
): PngHeader {
  const width = chunk.readUInt32BE(0);
  const height = chunk.readUInt32BE(4);
  const bitDepth = chunk[8];
  const colorType = chunk[9];
  const interlace = chunk[12];

  if (bitDepth !== 8) {
    throw new Error(
      `decodePng: only 8-bit images are supported, got ${bitDepth}-bit.`
    );
  }
  if (interlace !== 0) {
    throw new Error("decodePng: interlaced images are not supported.");
  }
  if (!(colorType in kChannelsPerColorType)) {
    throw new Error(`decodePng: unsupported color type ${colorType}.`);
  }

  return { width, height, colorType };
}

/**
 * Reverses the per-scanline filters in place, dropping the filter bytes.
 */
function unfilter(
  raw: Buffer,
  width: number,
  height: number,
  channels: number
): Buffer {
  const stride = width * channels;
  const out = Buffer.allocUnsafe(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const from = y * (stride + 1) + 1;
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
          throw new Error(`decodePng: unknown scanline filter ${filter}.`);
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

function toRGBA(
  scanline: Buffer,
  pixelCount: number,
  colorType: number,
  palette: PngPalette
): Uint8ClampedArray {
  const channels = kChannelsPerColorType[colorType];
  const pixels = new Uint8ClampedArray(pixelCount * 4);

  for (let index = 0; index < pixelCount; index++) {
    const from = index * channels;
    const to = index * 4;

    if (colorType === 3) {
      if (palette.entries === null) {
        throw new Error("decodePng: an indexed image has no PLTE chunk.");
      }
      const entry = scanline[from] * 3;
      pixels[to] = palette.entries[entry];
      pixels[to + 1] = palette.entries[entry + 1];
      pixels[to + 2] = palette.entries[entry + 2];
      pixels[to + 3] = palette.alpha?.[scanline[from]] ?? 255;
      continue;
    }

    if (colorType === 0 || colorType === 4) {
      pixels[to] = scanline[from];
      pixels[to + 1] = scanline[from];
      pixels[to + 2] = scanline[from];
      pixels[to + 3] = colorType === 4 ? scanline[from + 1] : 255;
      continue;
    }

    pixels[to] = scanline[from];
    pixels[to + 1] = scanline[from + 1];
    pixels[to + 2] = scanline[from + 2];
    pixels[to + 3] = colorType === 6 ? scanline[from + 3] : 255;
  }

  return pixels;
}
