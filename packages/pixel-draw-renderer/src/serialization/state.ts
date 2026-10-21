// Import Internal Dependencies
import {
  InvalidPixelArtFileError
} from "./errors/InvalidPixelArtFileError.ts";
import {
  decodePixelBytes,
  encodePixelBytes
} from "./pixelBytes.ts";
import {
  PIXEL_ART_FILE_VERSION,
  type PixelArtFile,
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
): PixelArtFile {
  return {
    version: PIXEL_ART_FILE_VERSION,
    ...pixelArtSnapshot(state)
  };
}

export function deserializePixelDocument(
  file: PixelArtFile,
  state: PixelDocumentState<PixelBuffer>
): void {
  if (!state.buffer.acceptsSize(file.size)) {
    throw new InvalidPixelArtFileError(
      `size ${file.size.x}x${file.size.y} exceeds the buffer bounds`
    );
  }

  const pixels = decodePixelBytes(file.pixels);
  const expected = file.size.x * file.size.y * 4;
  if (pixels.length < expected) {
    throw new InvalidPixelArtFileError(
      `pixels hold ${pixels.length} bytes, expected ${expected}`
    );
  }

  state.load({
    size: file.size,
    pixels,
    uvRegions: file.uvRegions,
    normalMap: file.normalMap,
    palette: file.palette
  });
}
