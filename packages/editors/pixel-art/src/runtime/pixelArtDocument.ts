// Import Third-party Dependencies
import {
  PixelDocument,
  decodePixelBytes,
  type PixelArtFile
} from "@jolly-pixel/pixel-draw.renderer";

export function pixelArtDocument(
  file: PixelArtFile
): PixelDocument {
  const document = new PixelDocument({
    size: file.size
  });
  document.loadSnapshot({
    size: file.size,
    pixels: decodePixelBytes(file.pixels),
    uvRegions: file.uvRegions,
    normalMap: file.normalMap ?? null,
    palette: file.palette,
    uvNets: file.uvNets
  });

  return document;
}
