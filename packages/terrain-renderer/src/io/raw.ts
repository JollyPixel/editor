// Import Internal Dependencies
import { InvalidImageError } from "./errors/InvalidImageError.ts";
import type { GrayImage } from "./png.ts";

export function encodeRaw(
  { samples }: GrayImage
): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => view.setUint16(index * 2, sample, true));

  return bytes;
}

export function decodeRaw(
  bytes: Uint8Array,
  size?: { readonly width: number; readonly height: number; }
): GrayImage {
  const count = bytes.length / 2;
  const side = Math.sqrt(count);
  const { width, height } = size ?? { width: side, height: side };
  if (!Number.isInteger(width) || !Number.isInteger(height) || width * height !== count) {
    throw new InvalidImageError(
      size === undefined ?
        "A RAW file without a sidecar must hold a square of 16-bit samples." :
        `The RAW file does not hold ${width}×${height} 16-bit samples.`
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  return {
    width,
    height,
    depth: 16,
    samples: Uint16Array.from({ length: count }, (_, index) => view.getUint16(index * 2, true))
  };
}
