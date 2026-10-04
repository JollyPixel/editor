// Import Internal Dependencies
import {
  InvalidPixelArtDocumentError
} from "./errors/InvalidPixelArtDocumentError.ts";
import {
  PIXEL_ART_DOCUMENT_VERSION,
  type PixelArtDocumentData
} from "./types.ts";
import { encodePixelBytes } from "./pixelBytes.ts";
import { TextureBounds } from "../buffer/TextureBounds.ts";
import { isUVRegionData } from "../uv/region/validation.ts";
import { NormalMapConfig } from "../normal/NormalMapConfig.ts";
import type { Vec2 } from "../types.ts";

export function createPixelArtDocument(
  size: Vec2,
  pixels: Uint8Array | Uint8ClampedArray = new Uint8Array(size.x * size.y * 4)
): PixelArtDocumentData {
  if (!TextureBounds.isSize(size)) {
    throw new InvalidPixelArtDocumentError("size is not a pair of positive integers");
  }

  const expected = size.x * size.y * 4;
  if (pixels.length !== expected) {
    throw new InvalidPixelArtDocumentError(
      `pixels hold ${pixels.length} bytes, expected ${expected}`
    );
  }

  return {
    version: PIXEL_ART_DOCUMENT_VERSION,
    size: {
      x: size.x,
      y: size.y
    },
    pixels: encodePixelBytes(pixels),
    uvRegions: []
  };
}

export function parsePixelArtDocument(
  value: unknown
): PixelArtDocumentData {
  if (typeof value !== "object" || value === null) {
    throw new InvalidPixelArtDocumentError("payload is not an object");
  }

  const document = value as Partial<PixelArtDocumentData>;
  if (document.version !== PIXEL_ART_DOCUMENT_VERSION) {
    throw new InvalidPixelArtDocumentError(
      `unsupported version ${String(document.version)}`
    );
  }
  if (!TextureBounds.isSize(document.size)) {
    throw new InvalidPixelArtDocumentError("size is not a pair of positive integers");
  }
  if (typeof document.pixels !== "string") {
    throw new InvalidPixelArtDocumentError("pixels is not a base64 string");
  }
  if (
    !Array.isArray(document.uvRegions) ||
    !document.uvRegions.every(isUVRegionData)
  ) {
    throw new InvalidPixelArtDocumentError("uvRegions contains invalid data");
  }

  const parsed: PixelArtDocumentData = {
    version: PIXEL_ART_DOCUMENT_VERSION,
    size: document.size,
    pixels: document.pixels,
    uvRegions: document.uvRegions
  };
  if (document.normalMap !== undefined) {
    const normalMap = NormalMapConfig.parse(document.normalMap);
    if (normalMap === null) {
      throw new InvalidPixelArtDocumentError("normalMap contains invalid data");
    }
    parsed.normalMap = normalMap.toJSON();
  }

  return parsed;
}

export function encodePixelArtDocument(
  document: PixelArtDocumentData
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(document)
  );
}

export function decodePixelArtDocument(
  data: Uint8Array
): PixelArtDocumentData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(data)
    );
  }
  catch (error) {
    throw new InvalidPixelArtDocumentError(
      "payload is not JSON",
      { cause: error }
    );
  }

  return parsePixelArtDocument(parsed);
}
