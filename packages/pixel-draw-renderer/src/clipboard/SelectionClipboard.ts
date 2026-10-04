// Import Internal Dependencies
import {
  decodeRasterBlob,
  encodeSelectionPng
} from "./selectionImage.ts";
import {
  decodeSelectionMetadata,
  encodeSelectionMetadata,
  type SelectionMetadata
} from "./selectionMetadata.ts";
import {
  JOLLYPIXEL_CLIPBOARD_TYPE,
  SUPPORTED_RASTER_TYPES,
  type ClipboardAdapter,
  type ClipboardOperationResult,
  type DecodedRasterImage,
  type DecodedSelection,
  type RasterBlobDecoder,
  type SelectionSnapshot
} from "./types.ts";
import type {
  RGBA8
} from "../types.ts";

export interface SelectionClipboardOptions {
  adapter: ClipboardAdapter | null;
  decodeRaster?: RasterBlobDecoder;
  supportsType?: (type: string) => boolean;
}

export interface ClipboardSelectionResult {
  result: ClipboardOperationResult;
  selection?: DecodedSelection;
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
  pixels: RGBA8[]
): RGBA8[] {
  return pixels.map((pixel) => {
    return { ...pixel };
  });
}

function defaultSupportsType(
  type: string
): boolean {
  return typeof ClipboardItem !== "undefined" &&
    typeof ClipboardItem.supports === "function" &&
    ClipboardItem.supports(type);
}

function hasValidDecodedDimensions(
  image: DecodedRasterImage
): boolean {
  return Number.isSafeInteger(image.width) &&
    Number.isSafeInteger(image.height) &&
    image.width > 0 &&
    image.height > 0;
}

function pasteResult(
  result: Omit<ClipboardOperationResult, "operation">,
  selection?: DecodedSelection
): ClipboardSelectionResult {
  return {
    result: {
      operation: "paste",
      ...result
    },
    ...(selection && { selection })
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
  #supportsType: (type: string) => boolean;
  #internal: SelectionSnapshot | null = null;

  constructor(
    options: SelectionClipboardOptions
  ) {
    this.#adapter = options.adapter;
    this.#decodeRaster = options.decodeRaster ?? decodeRasterBlob;
    this.#supportsType = options.supportsType ?? defaultSupportsType;
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
      const png = await encodeSelectionPng(snapshot);
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
      await this.#adapter.write(
        [new ClipboardItem(data)]
      );

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
      return this.#readInternal(
        maxSize,
        "no-image"
      );
    }

    let items: ClipboardItem[];
    try {
      items = await this.#adapter.read();
    }
    catch {
      return this.#readInternal(
        maxSize,
        "access-denied"
      );
    }

    for (const item of items) {
      const rasterType = SUPPORTED_RASTER_TYPES.find(
        (type) => item.types.includes(type)
      );
      if (!rasterType) {
        continue;
      }

      return this.#readItem(
        item,
        rasterType,
        maxSize
      );
    }

    return pasteResult({ code: "no-image", source: "system" });
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
      return pasteResult({ code: "decode-failed", source: "system" });
    }

    if (!hasValidDecodedDimensions(image)) {
      return pasteResult({ code: "decode-failed", source: "system" });
    }
    if (
      image.width > maxSize ||
      image.height > maxSize
    ) {
      return pasteResult({ code: "image-too-large", source: "system", maxSize });
    }
    if (image.pixels.length !== image.width * image.height) {
      return pasteResult({ code: "decode-failed", source: "system" });
    }

    const metadata = await this.#readMetadata(
      item,
      image
    );
    const mask = metadata?.mask ?? image.pixels.map(
      (pixel) => pixel.a > 0
    );
    if (!mask.some(Boolean)) {
      return pasteResult({ code: "image-empty", source: "system" });
    }

    return pasteResult({ code: "pasted", source: "system" }, {
      width: image.width,
      height: image.height,
      pixels: clonePixels(
        metadata?.pixels ?? image.pixels
      ),
      mask
    });
  }

  #readInternal(
    maxSize: number,
    failureCode: "no-image" | "access-denied"
  ): ClipboardSelectionResult {
    if (!this.#internal) {
      return pasteResult({ code: failureCode });
    }
    if (
      this.#internal.rect.width > maxSize ||
      this.#internal.rect.height > maxSize
    ) {
      return pasteResult({ code: "image-too-large", source: "internal", maxSize });
    }

    return pasteResult({ code: "pasted", source: "internal" }, {
      width: this.#internal.rect.width,
      height: this.#internal.rect.height,
      pixels: clonePixels(this.#internal.pixels),
      mask: [
        ...this.#internal.mask
      ]
    });
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
