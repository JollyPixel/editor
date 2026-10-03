// Import Third-party Dependencies
import {
  decodePixelBytes,
  decodePngPixels,
  encodePngPixels,
  type PixelBuffer,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PixelWireSnapshot } from "./types.ts";

export async function encodePixelSnapshot(
  buffer: PixelBuffer
): Promise<PixelWireSnapshot> {
  const size = buffer.size();
  const uvRegions = [...buffer.uvRegions].map((region) => region.toJSON());

  return {
    size,
    pixels: await encodePngPixels(buffer.pixels(), size),
    uvRegions,
    ...(buffer.normalMap && { normalMap: buffer.normalMap.toJSON() })
  };
}

export function loadPixelSnapshot(
  target: Pick<PixelDocument, "loadSnapshot">,
  snapshot: PixelWireSnapshot
): void | Promise<void> {
  const { size, pixels, uvRegions, normalMap = null } = snapshot;
  if (typeof pixels === "string") {
    target.loadSnapshot(
      size,
      decodePixelBytes(pixels),
      uvRegions,
      normalMap
    );

    return undefined;
  }

  return decodePngPixels(pixels, size).then((decoded) => {
    target.loadSnapshot(
      size,
      decoded,
      uvRegions,
      normalMap
    );
  });
}
