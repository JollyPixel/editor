// Import Third-party Dependencies
import {
  imageDataToPixels,
  pixelsToImageData
} from "@jolly-pixel/color";
import { encodePng } from "@jolly-pixel/image";
import { decodeRaster } from "@jolly-pixel/image/raster";

// Import Internal Dependencies
import type {
  DecodedRasterImage,
  SelectionSnapshot
} from "./types.ts";

// CONSTANTS
const kPngType = "image/png";
const kBytesPerPixel = 4;

/**
 * Interop format for other applications. Masked-out pixels keep their RGB and
 * take alpha 0. The bytes go straight to the encoder rather than through a
 * canvas, so partial alpha survives exactly.
 */
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

/**
 * Adapter for the clipboard surface, which is shaped in RGBA8 objects.
 * The per-pixel allocation happens once, here, rather than anywhere
 * upstream of it.
 */
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
