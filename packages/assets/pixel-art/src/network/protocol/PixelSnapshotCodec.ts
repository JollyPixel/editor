// Import Third-party Dependencies
import {
  decodePngPixels,
  encodePngPixels,
  pixelArtSnapshotFields,
  type PixelDocument,
  type PixelDocumentState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireSnapshot } from "./types.ts";

export function pixelWireSnapshot(
  state: PixelDocumentState
): PixelWireSnapshot {
  return {
    size: state.buffer.size(),
    pixels: new Uint8Array(state.buffer.pixels()),
    ...pixelArtSnapshotFields(state)
  };
}

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
  if (pixels instanceof Uint8Array) {
    target.loadSnapshot({
      ...snapshot,
      pixels: new Uint8ClampedArray(pixels)
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
