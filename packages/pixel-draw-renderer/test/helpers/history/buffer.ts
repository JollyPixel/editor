// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";

export const HISTORY_TEXTURE_SIZE = Object.freeze({
  x: 4,
  y: 4
});

export function makeHistoryBuffer(): PixelBuffer {
  return new PixelBuffer({
    size: {
      ...HISTORY_TEXTURE_SIZE
    },
    defaultColor: {
      r: 255,
      g: 255,
      b: 255,
      a: 255
    },
    maxSize: 8
  });
}
