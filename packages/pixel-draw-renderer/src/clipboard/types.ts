// Import Internal Dependencies
import type {
  RGBA8,
  SelectionRect
} from "../types.ts";

export const JOLLYPIXEL_CLIPBOARD_TYPE = "web application/x-jollypixel-selection+json";

export const SUPPORTED_RASTER_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
] as const;

export interface SelectionSnapshot {
  rect: SelectionRect;
  pixels: RGBA8[];
  mask: boolean[];
}

export interface DecodedSelection {
  width: number;
  height: number;
  pixels: RGBA8[];
  mask: boolean[];
}

export type SelectionMaskMetadata =
  | {
    encoding: "full";
  }
  | {
    encoding: "bitset";
    data: string;
  };

export interface SelectionClipboardMetadataV1 {
  version: 1;
  rect: SelectionRect;
  mask: SelectionMaskMetadata;
  /**
   * Base64 row-major RGBA8. Optional because the field postdates v1 readers.
   * Redundant with the PNG for copies this editor writes, which are now
   * byte-exact; it stays for readers of copies written before that.
   */
  pixels?: string;
}

export interface ClipboardAdapter {
  read(): Promise<ClipboardItem[]>;
  write(items: ClipboardItem[]): Promise<void>;
}

export type ClipboardOperation = "copy" | "paste";

export type ClipboardResultCode =
  | "copied"
  | "copied-internal-only"
  | "pasted"
  | "no-selection"
  | "busy"
  | "no-image"
  | "access-denied"
  | "image-empty"
  | "image-too-large"
  | "decode-failed"
  | "paste-failed";

export type ClipboardSource = "system" | "internal";

export interface ClipboardOperationResult {
  operation: ClipboardOperation;
  code: ClipboardResultCode;
  source?: ClipboardSource;
  maxSize?: number;
}

export interface DecodedRasterImage {
  width: number;
  height: number;
  pixels: RGBA8[];
}

export type RasterBlobDecoder = (
  blob: Blob
) => Promise<DecodedRasterImage>;
