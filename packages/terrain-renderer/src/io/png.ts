// Import Internal Dependencies
import { InvalidImageError } from "./errors/InvalidImageError.ts";

// CONSTANTS
const kSignature = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const kChunkOverhead = 12;
const kHeaderBytes = 13;
const kMaxSide = 16385;
const kFilterSub = 1;
const kFilterUp = 2;
const kFilterAverage = 3;
const kFilterPaeth = 4;
const kChannels: Readonly<Record<number, number>> = {
  0: 1,
  2: 3,
  4: 2,
  6: 4
};
const kCrcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value;
});

export type GrayDepth = 8 | 16;

export interface GrayImage {
  readonly width: number;
  readonly height: number;
  readonly depth: GrayDepth;
  /**
   * `width × height` samples, row-major from the top.
   */
  readonly samples: Uint16Array;
}

interface PngHeader {
  readonly width: number;
  readonly height: number;
  readonly depth: GrayDepth;
  readonly channels: number;
}

export async function encodePng(
  image: GrayImage
): Promise<Uint8Array> {
  const { width, height, depth } = image;
  const header = new Uint8Array(kHeaderBytes);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = depth;

  return concat([
    Uint8Array.from(kSignature),
    pngChunk("IHDR", header),
    pngChunk("IDAT", await transform(filteredRows(image), new CompressionStream("deflate"))),
    pngChunk("IEND", new Uint8Array(0))
  ]);
}

export async function decodePng(
  bytes: Uint8Array
): Promise<GrayImage> {
  if (!kSignature.every((byte, index) => bytes[index] === byte)) {
    throw new InvalidImageError("The file is not a PNG.");
  }

  const { header, data } = readChunks(bytes);
  const inflated = await inflate(data);
  const stride = header.width * header.channels * header.depth / 8;
  if (inflated.length < (stride + 1) * header.height) {
    throw new InvalidImageError("The PNG holds fewer rows than its header says.");
  }

  return {
    width: header.width,
    height: header.height,
    depth: header.depth,
    samples: firstChannel(unfiltered(inflated, header, stride), header, stride)
  };
}

function readChunks(
  bytes: Uint8Array
): { header: PngHeader; data: Uint8Array; } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let header: PngHeader | null = null;
  let offset: number = kSignature.length;
  while (offset + kChunkOverhead <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + kChunkOverhead + length;
    if (end > bytes.length || view.getUint32(end - 4) !== crc32(bytes.subarray(offset + 4, end - 4))) {
      throw new InvalidImageError("The PNG is truncated or corrupt.");
    }

    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const content = bytes.subarray(offset + 8, end - 4);
    if (type === "IHDR") {
      header = readHeader(content);
    }
    else if (type === "IDAT") {
      parts.push(content);
    }
    else if (type === "IEND") {
      break;
    }
    offset = end;
  }

  if (header === null || parts.length === 0) {
    throw new InvalidImageError("The PNG has no image data.");
  }

  return { header, data: concat(parts) };
}

function readHeader(
  content: Uint8Array
): PngHeader {
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const depth = content[8];
  const channels = kChannels[content[9]];
  if (channels === undefined) {
    throw new InvalidImageError("A palette PNG holds no height or weight values; save it as grayscale.");
  }
  if (depth !== 8 && depth !== 16) {
    throw new InvalidImageError(`A ${depth}-bit PNG is not supported; use 8 or 16 bits.`);
  }
  if (content[12] !== 0) {
    throw new InvalidImageError("An interlaced PNG is not supported.");
  }
  if (width === 0 || height === 0 || width > kMaxSide || height > kMaxSide) {
    throw new InvalidImageError(`A PNG side must be from 1 to ${kMaxSide} pixels.`);
  }

  return {
    width,
    height,
    depth,
    channels
  };
}

async function inflate(
  data: Uint8Array
): Promise<Uint8Array> {
  try {
    return await transform(data, new DecompressionStream("deflate"));
  }
  catch (cause) {
    throw new InvalidImageError("The PNG's image data is corrupt.", { cause });
  }
}

function unfiltered(
  inflated: Uint8Array,
  { height, channels, depth }: PngHeader,
  stride: number
): Uint8Array {
  const pixel = channels * depth / 8;
  const rows = new Uint8Array(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = inflated[row * (stride + 1)];
    const source = row * (stride + 1) + 1;
    const start = row * stride;
    for (let index = 0; index < stride; index++) {
      const left = index >= pixel ? rows[start + index - pixel] : 0;
      const up = row > 0 ? rows[start + index - stride] : 0;
      const corner = row > 0 && index >= pixel ? rows[start + index - stride - pixel] : 0;
      rows[start + index] = inflated[source + index] + predicted(filter, left, up, corner);
    }
  }

  return rows;
}

function predicted(
  filter: number,
  left: number,
  up: number,
  corner: number
): number {
  switch (filter) {
    case 0:
      return 0;
    case kFilterSub:
      return left;
    case kFilterUp:
      return up;
    case kFilterAverage:
      return (left + up) >> 1;
    case kFilterPaeth:
      return paeth(left, up, corner);
    default:
      throw new InvalidImageError(`The PNG uses the unknown filter ${filter}.`);
  }
}

function paeth(
  left: number,
  up: number,
  corner: number
): number {
  const estimate = left + up - corner;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toCorner = Math.abs(estimate - corner);
  if (toLeft <= toUp && toLeft <= toCorner) {
    return left;
  }

  return toUp <= toCorner ? up : corner;
}

function firstChannel(
  rows: Uint8Array,
  { width, height, depth, channels }: PngHeader,
  stride: number
): Uint16Array {
  const samples = new Uint16Array(width * height);
  const bytes = depth / 8;
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const offset = row * stride + column * channels * bytes;
      samples[row * width + column] = depth === 16 ?
        (rows[offset] << 8) | rows[offset + 1] :
        rows[offset];
    }
  }

  return samples;
}

function filteredRows(
  { width, height, depth, samples }: GrayImage
): Uint8Array {
  const bytes = depth / 8;
  const stride = width * bytes;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    const start = row * (stride + 1);
    filtered[start] = kFilterSub;
    for (let column = 0; column < width; column++) {
      const sample = samples[row * width + column];
      const left = column > 0 ? samples[row * width + column - 1] : 0;
      if (depth === 16) {
        filtered[start + 1 + column * 2] = (sample >> 8) - (left >> 8);
        filtered[start + 2 + column * 2] = sample - left;
      }
      else {
        filtered[start + 1 + column] = sample - left;
      }
    }
  }

  return filtered;
}

function pngChunk(
  type: string,
  content: Uint8Array
): Uint8Array {
  const chunk = new Uint8Array(content.length + kChunkOverhead);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, content.length);
  chunk.set(Uint8Array.from(type, (character) => character.charCodeAt(0)), 4);
  chunk.set(content, 8);
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));

  return chunk;
}

function crc32(
  bytes: Uint8Array
): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = kCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

async function transform(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const piped = new Blob([bytes.slice()]).stream().pipeThrough(stream);

  return new Uint8Array(await new Response(piped).arrayBuffer());
}

function concat(
  parts: readonly Uint8Array[]
): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }

  return joined;
}
