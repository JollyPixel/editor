// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server/kinds";
import {
  createPixelBufferFromPng,
  encodePixelArtDocument,
  PixelBuffer,
  serializePixelBuffer,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
export const PIXEL_ART_KIND = "pixelart";
export const PIXEL_ART_COMMAND = "pixelart.command";
export const PIXEL_ART_EXTENSION = ".pixelart";

export const PIXEL_ART_ASSET: AssetKindDescriptor = {
  kind: PIXEL_ART_KIND,
  label: "Pixel art",
  icon: {
    svg: `
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        class="tone-ink"
        d="M5 17l4-5 3 3 2-2 5 4H5Z"
        fill="currentColor"
      />
      <circle class="tone-ink" cx="16" cy="9" r="2" fill="currentColor" />
    `,
    tone: "pink"
  }
};

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
