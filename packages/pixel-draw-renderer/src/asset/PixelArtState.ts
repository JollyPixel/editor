// Import Internal Dependencies
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";

/**
 * `apply` is the sole buffer writer. Rooms only read and append.
 */
export interface PixelArtState {
  readonly buffer: PixelBuffer;
}
