// Import Third-party Dependencies
import {
  imageDataToPixels,
  pixelsToImageData
} from "@jolly-pixel/color";
import {
  fromUint8Array,
  isValid,
  toUint8Array
} from "js-base64";

// Import Internal Dependencies
import { filledArray } from "../utils/array.ts";
import type {
  DecodedRasterImage,
  SelectionClipboardMetadataV1,
  SelectionMaskMetadata,
  SelectionSnapshot
} from "./types.ts";
import type {
  RGBA8,
  SelectionRect
} from "../types.ts";

export interface SelectionMetadata {
  mask: boolean[];
  /**
   * `null` when the payload predates the lossless pixel channel.
   */
  pixels: RGBA8[] | null;
}

function encodeMask(
  mask: boolean[]
): SelectionMaskMetadata {
  if (mask.every(Boolean)) {
    return {
      encoding: "full"
    };
  }

  const bytes = new Uint8Array(
    Math.ceil(mask.length / 8)
  );
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      bytes[Math.floor(i / 8)] |= 1 << (i % 8);
    }
  }

  return {
    encoding: "bitset",
    data: fromUint8Array(bytes)
  };
}

function encodePixels(
  pixels: RGBA8[]
): string {
  const bytes = new Uint8ClampedArray(pixels.length * 4);
  pixelsToImageData(pixels, bytes);

  return fromUint8Array(new Uint8Array(bytes.buffer));
}

function decodeBase64(
  value: unknown,
  expectedLength: number
): Uint8Array | null {
  if (
    typeof value !== "string" ||
    !isValid(value)
  ) {
    return null;
  }

  let bytes: Uint8Array;
  try {
    bytes = toUint8Array(value);
  }
  catch {
    return null;
  }

  return bytes.length === expectedLength ? bytes : null;
}

function isSafeRect(
  value: unknown
): value is SelectionRect {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const rect = value as Record<string, unknown>;

  return Number.isSafeInteger(rect.x) &&
    Number.isSafeInteger(rect.y) &&
    Number.isSafeInteger(rect.width) &&
    Number.isSafeInteger(rect.height) &&
    Number(rect.width) > 0 &&
    Number(rect.height) > 0;
}

function decodeMask(
  value: unknown,
  length: number
): boolean[] | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const mask = value as Record<string, unknown>;
  if (mask.encoding === "full") {
    return filledArray(length, true);
  }
  if (mask.encoding !== "bitset") {
    return null;
  }

  const bytes = decodeBase64(
    mask.data,
    Math.ceil(length / 8)
  );
  if (!bytes) {
    return null;
  }

  const result: boolean[] = [];
  for (let i = 0; i < length; i++) {
    result[i] = (bytes[Math.floor(i / 8)] & (1 << (i % 8))) !== 0;
  }

  return result;
}

function decodePixels(
  value: unknown,
  length: number
): RGBA8[] | null {
  if (value === undefined) {
    return null;
  }

  const bytes = decodeBase64(
    value,
    length * 4
  );
  if (!bytes) {
    return null;
  }

  return imageDataToPixels(
    new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  );
}

export function encodeSelectionMetadata(
  snapshot: SelectionSnapshot
): SelectionClipboardMetadataV1 {
  return {
    version: 1,
    rect: {
      ...snapshot.rect
    },
    mask: encodeMask(snapshot.mask),
    pixels: encodePixels(snapshot.pixels)
  };
}

export function decodeSelectionMetadata(
  text: string,
  image: DecodedRasterImage
): SelectionMetadata | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  }
  catch {
    return null;
  }
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const metadata = value as Record<string, unknown>;
  if (
    metadata.version !== 1 ||
    !isSafeRect(metadata.rect) ||
    metadata.rect.width !== image.width ||
    metadata.rect.height !== image.height
  ) {
    return null;
  }

  const length = image.width * image.height;
  const mask = decodeMask(
    metadata.mask,
    length
  );
  if (!mask) {
    return null;
  }

  return {
    mask,
    pixels: decodePixels(
      metadata.pixels,
      length
    )
  };
}
