// Import Internal Dependencies
import {
  colorModelOf,
  type ColorModel
} from "./pixels.ts";
import { InvalidPngError } from "./errors/InvalidPngError.ts";

// CONSTANTS
const kHeaderSize = 13;
const kBitDepth = 8;

export interface PngHeader {
  readonly width: number;
  readonly height: number;
  readonly color: ColorModel;
}

export function readHeader(
  data: Uint8Array
): PngHeader {
  if (data.length < kHeaderSize) {
    throw new InvalidPngError("the IHDR chunk is truncated.");
  }

  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength
  );
  const width = view.getUint32(0);
  const height = view.getUint32(4);
  const bitDepth = data[8];
  const colorType = data[9];
  const interlace = data[12];

  if (width === 0 || height === 0) {
    throw new InvalidPngError(
      `dimensions must be positive, got ${width}x${height}.`
    );
  }
  if (bitDepth !== kBitDepth) {
    throw new InvalidPngError(
      `only 8-bit images are supported, got ${bitDepth}-bit.`
    );
  }
  if (interlace !== 0) {
    throw new InvalidPngError("interlaced images are not supported.");
  }
  const color = colorModelOf(colorType);
  if (color === undefined) {
    throw new InvalidPngError(`unsupported color type ${colorType}.`);
  }

  return {
    width,
    height,
    color
  };
}

export function writeHeader(
  header: PngHeader
): Uint8Array {
  const data = new Uint8Array(kHeaderSize);
  const view = new DataView(data.buffer);
  view.setUint32(0, header.width);
  view.setUint32(4, header.height);
  data[8] = kBitDepth;
  data[9] = header.color.type;

  return data;
}
