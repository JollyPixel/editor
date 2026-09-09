// Import Third-party Dependencies
import { decodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { PixelBuffer } from "./PixelBuffer.ts";
import type { Vec2 } from "../types.ts";

// CONSTANTS
// Mirrors PixelBuffer's own ceiling, which the decoded image may exceed.
const kDefaultMaxSize = 2048;

export interface PixelBufferFromPngOptions {
  /**
   * Maximum buffer dimension.
   * @default the image's own dimensions, or 2048 when it is smaller
   */
  maxSize?: number;
}

export async function createPixelBufferFromPng(
  data: Uint8Array,
  options: PixelBufferFromPngOptions = {}
): Promise<PixelBuffer> {
  const {
    width,
    height,
    data: samples
  } = await decodePng(data);
  const size: Vec2 = {
    x: width,
    y: height
  };

  const buffer = new PixelBuffer({
    size,
    maxSize: options.maxSize ?? Math.max(
      width,
      height,
      kDefaultMaxSize
    )
  });
  buffer.replacePixels(
    samples,
    size
  );

  return buffer;
}
