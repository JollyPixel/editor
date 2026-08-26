// Import Third-party Dependencies
import {
  fromUint8Array,
  toUint8Array
} from "js-base64";

// Import Internal Dependencies
import { PixelBuffer } from "../buffer/PixelBuffer.ts";
import { decodePng } from "../image/decodePng.ts";
import type { UVRegionData } from "../uv/UVRegion.ts";
import type { PixelBufferSnapshot } from "../network/types.ts";
import type { Vec2 } from "../types.ts";

// CONSTANTS
const kDocumentVersion = 1;
// Mirrors PixelBuffer's own ceiling, which the decoded image may exceed.
const kDefaultMaxSize = 2048;

/**
 * Serialized pixel-art state, including UV regions that PNG cannot store.
 * The payload matches `PixelBufferSnapshot`.
 */
export interface PixelArtDocumentData extends PixelBufferSnapshot {
  readonly version: typeof kDocumentVersion;
}

export class InvalidPixelArtDocumentError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid pixel-art document: ${reason}`, options);
    this.name = "InvalidPixelArtDocumentError";
  }
}

export function pixelArtSnapshot(
  buffer: PixelBuffer
): PixelBufferSnapshot {
  return {
    size: buffer.size(),
    pixels: fromUint8Array(
      new Uint8Array(buffer.pixels())
    ),
    uvRegions: [
      ...buffer.uvRegions
    ].map((region) => region.toJSON())
  };
}

export function encodePixelArtDocument(
  buffer: PixelBuffer
): Uint8Array {
  const document: PixelArtDocumentData = {
    version: kDocumentVersion,
    ...pixelArtSnapshot(buffer)
  };

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

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidPixelArtDocumentError("payload is not an object");
  }

  const document = parsed as Partial<PixelArtDocumentData>;
  if (document.version !== kDocumentVersion) {
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
  if (!Array.isArray(document.uvRegions)) {
    throw new InvalidPixelArtDocumentError("uvRegions is not an array");
  }

  return {
    version: kDocumentVersion,
    size: document.size,
    pixels: document.pixels,
    uvRegions: document.uvRegions as UVRegionData[]
  };
}

/**
 * Clears existing regions before replacing the complete buffer state.
 */
export function loadPixelArtDocument(
  buffer: PixelBuffer,
  document: PixelArtDocumentData
): void {
  if (!buffer.acceptsSize(document.size)) {
    throw new InvalidPixelArtDocumentError(
      `size ${document.size.x}x${document.size.y} exceeds the buffer bounds`
    );
  }

  const pixels = new Uint8ClampedArray(
    toUint8Array(document.pixels)
  );
  const expected = document.size.x * document.size.y * 4;
  if (pixels.length < expected) {
    throw new InvalidPixelArtDocumentError(
      `pixels hold ${pixels.length} bytes, expected ${expected}`
    );
  }

  buffer.replacePixels(pixels, document.size);
  buffer.uvRegions.clear();
  for (const region of document.uvRegions) {
    buffer.uvRegions.set(region);
  }
}

export function createPixelArtBuffer(
  size: Vec2
): PixelBuffer {
  return new PixelBuffer({ size });
}

export interface PixelArtBufferFromPngOptions {
  /**
   * Maximum buffer dimension.
   * @default the image's own dimensions, or 2048 when it is smaller
   */
  maxSize?: number;
}

/**
 * Fills a buffer with an image file's exact samples, sized to the image. UV
 * regions stay empty, since PNG cannot carry them.
 */
export async function createPixelArtBufferFromPng(
  data: Uint8Array,
  options: PixelArtBufferFromPngOptions = {}
): Promise<PixelBuffer> {
  const { width, height, pixels } = await decodePng(data);
  const size: Vec2 = {
    x: width,
    y: height
  };

  const buffer = new PixelBuffer({
    size,
    maxSize: options.maxSize ?? Math.max(width, height, kDefaultMaxSize)
  });
  buffer.replacePixels(pixels, size);

  return buffer;
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
