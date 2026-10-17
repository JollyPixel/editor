// Import Third-party Dependencies
import {
  imageDataToPixels,
  pixelsToImageData
} from "@jolly-pixel/color";
import { encodePng } from "@jolly-pixel/image";
import { decodeRaster } from "@jolly-pixel/image/browser";

// Import Internal Dependencies
import type {
  DecodedRasterImage,
  SelectionSnapshot
} from "./types.ts";

// CONSTANTS
const kPngType = "image/png";
const kBytesPerPixel = 4;

export async function encodeSelectionPng(
  snapshot: SelectionSnapshot
): Promise<Blob> {
  const { width, height } = snapshot.rect;
  const data = new Uint8ClampedArray(width * height * kBytesPerPixel);
  pixelsToImageData(snapshot.pixels, data, snapshot.mask);

  const png = await encodePng({
    width,
    height,
    data
  });

  return new Blob([png], { type: kPngType });
}

export async function decodeRasterBlob(
  blob: Blob
): Promise<DecodedRasterImage> {
  const {
    width,
    height,
    data
  } = await decodeRaster(blob);

  return {
    width,
    height,
    pixels: imageDataToPixels(data)
  };
}
