// Import Third-party Dependencies
import {
  decodePng,
  encodePng
} from "@jolly-pixel/image";

// Import Internal Dependencies
import {
  decodeBase64,
  encodeBase64
} from "../utils/base64.ts";
import {
  InvalidPixelArtFileError
} from "./errors/InvalidPixelArtFileError.ts";
import type { Vec2 } from "../types.ts";

export interface PngPixels {
  readonly format: "png";
  readonly data: string;
}

export function encodePixelBytes(
  pixels: Uint8Array | Uint8ClampedArray
): string {
  return encodeBase64(
    new Uint8Array(
      pixels.buffer,
      pixels.byteOffset,
      pixels.byteLength
    )
  );
}

export function decodePixelBytes(
  pixels: string
): Uint8ClampedArray {
  const bytes = decodeBase64(pixels);

  return new Uint8ClampedArray(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );
}

export async function encodePngPixels(
  pixels: Uint8ClampedArray,
  size: Vec2
): Promise<PngPixels> {
  const png = await encodePng(
    {
      width: size.x,
      height: size.y,
      data: pixels.subarray(0, size.x * size.y * 4)
    },
    { filter: "none" }
  );

  return {
    format: "png",
    data: encodeBase64(png)
  };
}

export async function decodePngPixels(
  pixels: PngPixels,
  size: Vec2
): Promise<Uint8ClampedArray> {
  const image = await decodePng(
    decodeBase64(pixels.data)
  );
  if (
    image.width !== size.x ||
    image.height !== size.y
  ) {
    throw new InvalidPixelArtFileError(
      `PNG pixels are ${image.width}x${image.height}, ` +
      `expected ${size.x}x${size.y}`
    );
  }

  return image.data;
}
