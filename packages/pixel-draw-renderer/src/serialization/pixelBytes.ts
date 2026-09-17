// Import Third-party Dependencies
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";

export function encodePixelBytes(
  pixels: Uint8Array | Uint8ClampedArray
): string {
  return fromUint8Array(
    new Uint8Array(
      pixels.buffer,
      pixels.byteOffset,
      pixels.byteLength
    )
  );
}

export function decodePixelBytes(
  pixels: string
): Uint8ClampedArray {
  return new Uint8ClampedArray(
    toUint8Array(pixels)
  );
}
