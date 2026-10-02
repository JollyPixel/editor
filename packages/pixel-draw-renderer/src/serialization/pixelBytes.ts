// Import Third-party Dependencies
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";
import {
  decodePng,
  encodePng
} from "@jolly-pixel/image";

// Import Internal Dependencies
import {
  InvalidPixelArtDocumentError
} from "./errors/InvalidPixelArtDocumentError.ts";
import type { Vec2 } from "../types.ts";

export interface PngPixels {
  readonly format: "png";
  readonly data: string;
}

export function encodePixelBytes(
  pixels: Uint8Array | Uint8ClampedArray
): string {
  return fromUint8Array(
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
  return new Uint8ClampedArray(
    toUint8Array(pixels)
  );
}

export async function encodePngPixels(
  pixels: Uint8ClampedArray,
  size: Vec2
): Promise<PngPixels> {
  const png = await encodePng({
    width: size.x,
    height: size.y,
    data: pixels.subarray(0, size.x * size.y * 4)
  });

  return {
    format: "png",
    data: fromUint8Array(png)
  };
}

export async function decodePngPixels(
  pixels: PngPixels,
  size: Vec2
): Promise<Uint8ClampedArray> {
  const image = await decodePng(
    toUint8Array(pixels.data)
  );
  if (
    image.width !== size.x ||
    image.height !== size.y
  ) {
    throw new InvalidPixelArtDocumentError(
      `PNG pixels are ${image.width}x${image.height}, ` +
      `expected ${size.x}x${size.y}`
    );
  }

  return image.data;
}
