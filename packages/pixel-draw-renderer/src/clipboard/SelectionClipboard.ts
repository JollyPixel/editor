// Import Third-party Dependencies
import {
  fromUint8Array,
  isValid,
  toUint8Array
} from "js-base64";

// Import Internal Dependencies
import {
  decodeRasterBlob,
  encodeSelectionPng
} from "./selectionImage.ts";
import {
  JOLLYPIXEL_CLIPBOARD_TYPE,
  SUPPORTED_RASTER_TYPES,
  type ClipboardAdapter,
  type ClipboardOperationResult,
  type DecodedRasterImage,
  type DecodedSelection,
  type RasterBlobDecoder,
  type SelectionClipboardMetadataV1,
  type SelectionMaskMetadata,
  type SelectionPngEncoder,
  type SelectionSnapshot
} from "./types.ts";
import type {
  RGBA,
  SelectionRect
} from "../types.ts";

export interface SelectionClipboardOptions {
  adapter: ClipboardAdapter | null;
  decodeRaster?: RasterBlobDecoder;
  encodePng?: SelectionPngEncoder;
  createItem?: (data: Record<string, Blob>) => ClipboardItem;
  supportsType?: (type: string) => boolean;
}

export interface ClipboardSelectionResult {
  result: ClipboardOperationResult;
  selection?: DecodedSelection;
}

interface SelectionMetadata {
  mask: boolean[];
  /**
   * `null` when the payload predates the lossless pixel channel.
   */
  pixels: RGBA[] | null;
}

function cloneSnapshot(
  snapshot: SelectionSnapshot
): SelectionSnapshot {
  return {
    rect: { ...snapshot.rect },
    pixels: snapshot.pixels.map((pixel) => {
      return { ...pixel };
    }),
    mask: [...snapshot.mask]
  };
}

function clonePixels(
  pixels: RGBA[]
): RGBA[] {
  return pixels.map((pixel) => {
    return { ...pixel };
  });
}

function encodeMask(
  mask: boolean[]
): SelectionMaskMetadata {
  if (mask.every(Boolean)) {
    return { encoding: "full" };
  }

  const bytes = new Uint8Array(Math.ceil(mask.length / 8));
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
  pixels: RGBA[]
): string {
  const bytes = new Uint8Array(pixels.length * 4);

  for (let i = 0; i < pixels.length; i++) {
    const offset = i * 4;
    bytes[offset] = pixels[i].r;
    bytes[offset + 1] = pixels[i].g;
    bytes[offset + 2] = pixels[i].b;
    bytes[offset + 3] = pixels[i].a;
  }

  return fromUint8Array(bytes);
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
  if (!value || typeof value !== "object") {
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
  if (!value || typeof value !== "object") {
    return null;
  }

  const mask = value as Record<string, unknown>;
  if (mask.encoding === "full") {
    return new Array(length).fill(true);
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

  const result = new Array<boolean>(length);
  for (let i = 0; i < length; i++) {
    result[i] = (bytes[Math.floor(i / 8)] & (1 << (i % 8))) !== 0;
  }

  return result;
}

function decodePixels(
  value: unknown,
  length: number
): RGBA[] | null {
  if (value === undefined) {
    return null;
  }

  const bytes = decodeBase64(value, length * 4);
  if (!bytes) {
    return null;
  }

  const pixels = new Array<RGBA>(length);
  for (let i = 0; i < length; i++) {
    const offset = i * 4;
    pixels[i] = {
      r: bytes[offset],
      g: bytes[offset + 1],
      b: bytes[offset + 2],
      a: bytes[offset + 3]
    };
  }

  return pixels;
}

export function encodeSelectionMetadata(
  snapshot: SelectionSnapshot
): SelectionClipboardMetadataV1 {
  return {
    version: 1,
    rect: { ...snapshot.rect },
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
  if (!value || typeof value !== "object") {
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
  const mask = decodeMask(metadata.mask, length);
  if (!mask) {
    return null;
  }

  return {
    mask,
    pixels: decodePixels(metadata.pixels, length)
  };
}

function defaultSupportsType(
  type: string
): boolean {
  return typeof ClipboardItem !== "undefined" &&
    typeof ClipboardItem.supports === "function" &&
    ClipboardItem.supports(type);
}

function defaultCreateItem(
  data: Record<string, Blob>
): ClipboardItem {
  return new ClipboardItem(data);
}

function hasValidDecodedDimensions(
  image: DecodedRasterImage
): boolean {
  return Number.isSafeInteger(image.width) &&
    Number.isSafeInteger(image.height) &&
    image.width > 0 &&
    image.height > 0;
}

function pasteFailure(
  code: "decode-failed" | "image-empty" | "no-image",
  source: "system" | "internal" = "system"
): ClipboardSelectionResult {
  return {
    result: {
      operation: "paste",
      code,
      source
    }
  };
}

/**
 * Reads and writes selections through a clipboard adapter, with an in-memory
 * fallback. Decoding only: where a pasted selection lands is the canvas's
 * call, so `read` returns an unplaced {@link DecodedSelection}.
 */
export class SelectionClipboard {
  #adapter: ClipboardAdapter | null;
  #decodeRaster: RasterBlobDecoder;
  #encodePng: SelectionPngEncoder;
  #createItem: (data: Record<string, Blob>) => ClipboardItem;
  #supportsType: (type: string) => boolean;
  #internal: SelectionSnapshot | null = null;

  constructor(
    options: SelectionClipboardOptions
  ) {
    this.#adapter = options.adapter;
    this.#decodeRaster = options.decodeRaster ?? decodeRasterBlob;
    this.#encodePng = options.encodePng ?? encodeSelectionPng;
    this.#createItem = options.createItem ?? defaultCreateItem;
    this.#supportsType = options.supportsType ?? defaultSupportsType;
  }

  get hasInternalSnapshot(): boolean {
    return this.#internal !== null;
  }

  async copy(
    snapshot: SelectionSnapshot
  ): Promise<ClipboardOperationResult> {
    this.#internal = cloneSnapshot(snapshot);
    if (!this.#adapter) {
      return {
        operation: "copy",
        code: "copied-internal-only",
        source: "internal"
      };
    }

    try {
      const png = await this.#encodePng(snapshot);
      const data: Record<string, Blob> = {
        "image/png": png
      };
      if (this.#supportsType(JOLLYPIXEL_CLIPBOARD_TYPE)) {
        const metadata = encodeSelectionMetadata(snapshot);
        data[JOLLYPIXEL_CLIPBOARD_TYPE] = new Blob(
          [JSON.stringify(metadata)],
          { type: JOLLYPIXEL_CLIPBOARD_TYPE }
        );
      }
      await this.#adapter.write([this.#createItem(data)]);

      return {
        operation: "copy",
        code: "copied",
        source: "system"
      };
    }
    catch {
      return {
        operation: "copy",
        code: "copied-internal-only",
        source: "internal"
      };
    }
  }

  async read(
    maxSize: number
  ): Promise<ClipboardSelectionResult> {
    if (!this.#adapter) {
      return this.#readInternal(maxSize, "no-image");
    }

    let items: ClipboardItem[];
    try {
      items = await this.#adapter.read();
    }
    catch {
      return this.#readInternal(maxSize, "access-denied");
    }

    for (const item of items) {
      const rasterType = SUPPORTED_RASTER_TYPES.find(
        (type) => item.types.includes(type)
      );
      if (!rasterType) {
        continue;
      }

      return this.#readItem(item, rasterType, maxSize);
    }

    // A readable system clipboard without an image wins over our own stale
    // copy: the user's last copy happened elsewhere.
    return pasteFailure("no-image");
  }

  async #readItem(
    item: ClipboardItem,
    rasterType: string,
    maxSize: number
  ): Promise<ClipboardSelectionResult> {
    let image: DecodedRasterImage;
    try {
      image = await this.#decodeRaster(
        await item.getType(rasterType)
      );
    }
    catch {
      return pasteFailure("decode-failed");
    }

    if (!hasValidDecodedDimensions(image)) {
      return pasteFailure("decode-failed");
    }
    if (
      image.width > maxSize ||
      image.height > maxSize
    ) {
      return {
        result: {
          operation: "paste",
          code: "image-too-large",
          source: "system",
          maxSize
        }
      };
    }
    if (image.pixels.length !== image.width * image.height) {
      return pasteFailure("decode-failed");
    }

    const metadata = await this.#readMetadata(item, image);
    const mask = metadata?.mask ?? image.pixels.map(
      (pixel) => pixel.a > 0
    );
    if (!mask.some(Boolean)) {
      return pasteFailure("image-empty");
    }

    return {
      result: {
        operation: "paste",
        code: "pasted",
        source: "system"
      },
      selection: {
        width: image.width,
        height: image.height,
        // Our own metadata carries exact RGBA; the PNG does not.
        pixels: clonePixels(metadata?.pixels ?? image.pixels),
        mask
      }
    };
  }

  #readInternal(
    maxSize: number,
    failureCode: "no-image" | "access-denied"
  ): ClipboardSelectionResult {
    if (!this.#internal) {
      return {
        result: {
          operation: "paste",
          code: failureCode
        }
      };
    }
    if (
      this.#internal.rect.width > maxSize ||
      this.#internal.rect.height > maxSize
    ) {
      return {
        result: {
          operation: "paste",
          code: "image-too-large",
          source: "internal",
          maxSize
        }
      };
    }

    return {
      result: {
        operation: "paste",
        code: "pasted",
        source: "internal"
      },
      selection: {
        width: this.#internal.rect.width,
        height: this.#internal.rect.height,
        pixels: clonePixels(this.#internal.pixels),
        mask: [...this.#internal.mask]
      }
    };
  }

  async #readMetadata(
    item: ClipboardItem,
    image: DecodedRasterImage
  ): Promise<SelectionMetadata | null> {
    if (!item.types.includes(JOLLYPIXEL_CLIPBOARD_TYPE)) {
      return null;
    }

    try {
      const blob = await item.getType(
        JOLLYPIXEL_CLIPBOARD_TYPE
      );

      return decodeSelectionMetadata(
        await blob.text(),
        image
      );
    }
    catch {
      return null;
    }
  }
}
