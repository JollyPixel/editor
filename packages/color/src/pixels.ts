// Import Internal Dependencies
import type { RGBA8 } from "./types.ts";

// CONSTANTS
const kBytesPerPixel = 4;

/**
 * Copies `ImageData` bytes so returned pixels outlive the buffer.
 */
export function imageDataToPixels(
  data: Uint8ClampedArray
): RGBA8[] {
  const pixels: RGBA8[] = new Array(
    data.length / kBytesPerPixel
  );

  for (let i = 0; i < pixels.length; i++) {
    const offset = i * kBytesPerPixel;
    pixels[i] = {
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2],
      a: data[offset + 3]
    };
  }

  return pixels;
}

/**
 * Writes in place; masked pixels keep RGB but receive zero alpha.
 */
export function pixelsToImageData(
  pixels: readonly RGBA8[],
  data: Uint8ClampedArray,
  mask?: readonly boolean[]
): void {
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    const offset = i * kBytesPerPixel;
    data[offset] = pixel.r;
    data[offset + 1] = pixel.g;
    data[offset + 2] = pixel.b;
    data[offset + 3] = mask !== undefined && !mask[i] ? 0 : pixel.a;
  }
}
