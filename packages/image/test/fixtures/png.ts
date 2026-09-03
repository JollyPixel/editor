// Import Node.js Dependencies
import { Buffer } from "node:buffer";

// CONSTANTS
export const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
]);

export interface PngHeaderOptions {
  bitDepth?: number;
  interlace?: number;
}

/**
 * The decoder never verifies CRCs, so the trailing four bytes stay zero.
 */
export function chunk(
  type: string,
  data: Buffer
): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  return Buffer.concat([
    length,
    Buffer.from(type, "ascii"),
    data,
    Buffer.alloc(4)
  ]);
}

export function header(
  width: number,
  height: number,
  colorType: number,
  options: PngHeaderOptions = {}
): Buffer {
  const { bitDepth = 8, interlace = 0 } = options;
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = bitDepth;
  data[9] = colorType;
  data[12] = interlace;

  return chunk("IHDR", data);
}

/**
 * Wraps chunks between the signature and an empty IEND.
 */
export function png(
  chunks: Buffer[]
): Uint8Array<ArrayBuffer> {
  const merged = Buffer.concat([
    PNG_SIGNATURE,
    ...chunks,
    chunk("IEND", Buffer.alloc(0))
  ]);
  const out = new Uint8Array(merged.length);
  out.set(merged);

  return out;
}
