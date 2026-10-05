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
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type { PixelDocumentState } from "../sync/PixelDocumentState.ts";

export function pixelArtSnapshot(
  state: PixelDocumentState<DefaultPixelBuffer>
): PixelBufferSnapshot {
  const { buffer, normalMap } = state;

  return {
    size: buffer.size(),
    pixels: encodePixelBytes(buffer.pixels()),
    uvRegions: [
      ...state.uv
    ].map((region) => region.toJSON()),
    palette: state.palette.toJSON(),
    ...(normalMap && { normalMap: normalMap.toJSON() })
  };
}

export function serializePixelDocument(
  state: PixelDocumentState<DefaultPixelBuffer>
): PixelArtDocumentData {
  return {
    version: PIXEL_ART_DOCUMENT_VERSION,
    ...pixelArtSnapshot(state)
  };
}

export function deserializePixelDocument(
  document: PixelArtDocumentData,
  state: PixelDocumentState<PixelBuffer>
): void {
  if (!state.buffer.acceptsSize(document.size)) {
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

  state.load({
    size: document.size,
    pixels,
    uvRegions: document.uvRegions,
    normalMap: document.normalMap,
    palette: document.palette
  });
}
