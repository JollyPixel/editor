// Import Internal Dependencies
import {
  InvalidPixelArtDocumentError
} from "./errors/InvalidPixelArtDocumentError.ts";
import {
  PIXEL_ART_DOCUMENT_VERSION,
  type PixelArtDocumentData
} from "./types.ts";
import { isUVRegionData } from "../uv/validation.ts";
import type { Vec2 } from "../types.ts";

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
  if (!isSize(document.size)) {
    throw new InvalidPixelArtDocumentError("size is not a pair of integers");
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

  return {
    version: PIXEL_ART_DOCUMENT_VERSION,
    size: document.size,
    pixels: document.pixels,
    uvRegions: document.uvRegions
  };
}

export function encodePixelArtDocument(
  document: PixelArtDocumentData
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(document)
  );
}

/**
 * Rejects malformed persisted documents.
 */
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

function isSize(
  value: unknown
): value is Vec2 {
  return typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    Number.isInteger(value.x) &&
    Number.isInteger(value.y);
}
