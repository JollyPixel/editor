// Import Internal Dependencies
import {
  InvalidPixelArtDocumentError
} from "./errors/InvalidPixelArtDocumentError.ts";
import {
  decodePixelBytes,
  encodePixelBytes
} from "./pixelBytes.ts";
import {
  PIXEL_ART_DOCUMENT_VERSION,
  type PixelArtDocumentData,
  type PixelBufferSnapshot
} from "./types.ts";
import type { PixelBuffer } from "../buffer/PixelBuffer.ts";

export function pixelArtSnapshot(
  buffer: PixelBuffer
): PixelBufferSnapshot {
  return {
    size: buffer.size(),
    pixels: encodePixelBytes(buffer.pixels()),
    uvRegions: [
      ...buffer.uvRegions
    ].map((region) => region.toJSON())
  };
}

export function serializePixelBuffer(
  buffer: PixelBuffer
): PixelArtDocumentData {
  return {
    version: PIXEL_ART_DOCUMENT_VERSION,
    ...pixelArtSnapshot(buffer)
  };
}

/**
 * Clears existing regions before replacing the complete buffer state.
 */
export function deserializePixelBuffer(
  document: PixelArtDocumentData,
  buffer: PixelBuffer
): void {
  if (!buffer.acceptsSize(document.size)) {
    throw new InvalidPixelArtDocumentError(
      `size ${document.size.x}x${document.size.y} exceeds the buffer bounds`
    );
  }

  const pixels = decodePixelBytes(document.pixels);
  const expected = document.size.x * document.size.y * 4;
  if (pixels.length < expected) {
    throw new InvalidPixelArtDocumentError(
      `pixels hold ${pixels.length} bytes, expected ${expected}`
    );
  }

  buffer.replacePixels(pixels, document.size);
  buffer.uvRegions.clear();
  for (const region of document.uvRegions) {
    buffer.uvRegions.set(region);
  }
}
