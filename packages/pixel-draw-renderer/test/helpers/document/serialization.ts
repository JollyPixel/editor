// Import Internal Dependencies
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import { PixelDocumentState } from "#src/sync/PixelDocumentState.ts";
import type { Vec2 } from "#src/types.ts";

export function createDocumentState(
  size: Vec2,
  maxSize?: number
): PixelDocumentState {
  return new PixelDocumentState({
    buffer: new PixelBuffer({ size, maxSize })
  });
}

export function jsonBytes(
  payload: unknown
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}
