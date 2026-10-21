// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  createPixelBufferFromPng,
  encodePixelArtFile,
  PixelDocumentState,
  serializePixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_ICON } from "./icons.ts";

// CONSTANTS
export const PIXEL_ART_KIND = "pixelart";
export const PIXEL_ART_COMMAND = "pixelart.command";
export const PIXEL_ART_EXTENSION = ".pixelart";
const kMaxTextureSize = 2048;

export const PIXEL_ART_ASSET: AssetKindDescriptor = {
  kind: PIXEL_ART_KIND,
  label: "Pixel art",
  extension: PIXEL_ART_EXTENSION,
  icon: PIXEL_ART_ICON
};

export async function pixelArtContentFromPng(
  png: Uint8Array
): Promise<Uint8Array> {
  const state = new PixelDocumentState({
    buffer: await createPixelBufferFromPng(png, {
      maxSize: kMaxTextureSize
    })
  });

  return encodePixelArtFile(
    serializePixelDocument(state)
  );
}
