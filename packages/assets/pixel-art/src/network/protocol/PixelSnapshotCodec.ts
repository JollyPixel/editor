// Import Third-party Dependencies
import {
  decodePixelBytes,
  decodePngPixels,
  encodePngPixels,
  pixelArtSnapshotFields,
  type PixelDocument,
  type PixelDocumentState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireSnapshot } from "./types.ts";

export async function encodePixelSnapshot(
  state: PixelDocumentState
): Promise<PixelWireSnapshot> {
  const size = state.buffer.size();

  return {
    size,
    pixels: await encodePngPixels(state.buffer.pixels(), size),
    ...pixelArtSnapshotFields(state)
  };
}

export function loadPixelSnapshot(
  target: Pick<PixelDocument, "loadSnapshot">,
  snapshot: PixelWireSnapshot
): void | Promise<void> {
  const { size, pixels } = snapshot;
  if (typeof pixels === "string") {
    target.loadSnapshot({
      ...snapshot,
      pixels: decodePixelBytes(pixels)
    });

    return undefined;
  }

  return decodePngPixels(pixels, size).then((decoded) => {
    target.loadSnapshot({
      ...snapshot,
      pixels: decoded
    });
  });
}
