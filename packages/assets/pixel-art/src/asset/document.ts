// Import Third-party Dependencies
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export interface EncodedPixelArt {
  size: Vec2;
  content: Uint8Array;
}

export function createPixelArtDocument(
  size: Vec2
): Uint8Array {
  return encodePixelArtDocument(
    serializePixelBuffer(new PixelBuffer({ size }))
  );
}

export async function pixelArtDocumentFromPng(
  png: Uint8Array
): Promise<EncodedPixelArt> {
  const buffer = await createPixelBufferFromPng(png);

  return {
    size: buffer.size(),
    content: encodePixelArtDocument(serializePixelBuffer(buffer))
  };
}
