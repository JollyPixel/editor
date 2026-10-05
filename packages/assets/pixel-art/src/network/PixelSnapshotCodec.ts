// Import Third-party Dependencies
import {
  decodePixelBytes,
  decodePngPixels,
  encodePngPixels,
  type PixelDocument,
  type PixelDocumentState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireSnapshot } from "./types.ts";

export async function encodePixelSnapshot(
  state: PixelDocumentState
): Promise<PixelWireSnapshot> {
  const { buffer, normalMap } = state;
  const size = buffer.size();
  const uvRegions = [...state.uv].map((region) => region.toJSON());

  return {
    size,
    pixels: await encodePngPixels(buffer.pixels(), size),
    uvRegions,
    palette: state.palette.toJSON(),
    ...(normalMap && { normalMap: normalMap.toJSON() })
  };
}

export function loadPixelSnapshot(
  target: Pick<PixelDocument, "loadSnapshot">,
  snapshot: PixelWireSnapshot
): void | Promise<void> {
  const { size, pixels, uvRegions, normalMap = null, palette } = snapshot;
  if (typeof pixels === "string") {
    target.loadSnapshot(
      size,
      decodePixelBytes(pixels),
      uvRegions,
      normalMap,
      palette
    );

    return undefined;
  }

  return decodePngPixels(pixels, size).then((decoded) => {
    target.loadSnapshot(
      size,
      decoded,
      uvRegions,
      normalMap,
      palette
    );
  });
}
