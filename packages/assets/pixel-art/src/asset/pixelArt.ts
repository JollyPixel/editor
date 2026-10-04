// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  PixelBuffer,
  PixelDocumentState,
  serializePixelDocument,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_ICON } from "./icons.ts";

// CONSTANTS
export const PIXEL_ART_KIND = "pixelart";
export const PIXEL_ART_COMMAND = "pixelart.command";
export const PIXEL_ART_EXTENSION = ".pixelart";

export const PIXEL_ART_ASSET: AssetKindDescriptor = {
  kind: PIXEL_ART_KIND,
  label: "Pixel art",
  extension: PIXEL_ART_EXTENSION,
  icon: PIXEL_ART_ICON
};

export interface EncodedPixelArt {
  size: Vec2;
  content: Uint8Array;
}

export function createPixelArtDocument(
  size: Vec2
): Uint8Array {
  const state = new PixelDocumentState({
    buffer: new PixelBuffer({
      size
    })
  });

  return encodePixelArtDocument(
    serializePixelDocument(state)
  );
}

export async function pixelArtDocumentFromPng(
  png: Uint8Array
): Promise<EncodedPixelArt> {
  const buffer = await createPixelBufferFromPng(png);
  const state = new PixelDocumentState({
    buffer
  });

  return {
    size: buffer.size(),
    content: encodePixelArtDocument(
      serializePixelDocument(state)
    )
  };
}
