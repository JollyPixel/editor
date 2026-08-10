// Import Internal Dependencies
import type {
  RGBA,
  SelectionRect
} from "../types.ts";

export const JOLLYPIXEL_CLIPBOARD_TYPE = "web application/x-jollypixel-selection+json";

export const SUPPORTED_RASTER_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
] as const;

export type SupportedRasterType = typeof SUPPORTED_RASTER_TYPES[number];

/**
 * A selection placed on the texture: `pixels` and `mask` are row-major over
 * `rect`.
 */
export interface SelectionSnapshot {
  rect: SelectionRect;
  pixels: RGBA[];
  mask: boolean[];
}

/**
 * Clipboard content that has been decoded but not yet placed. Where it lands
 * depends on the cursor, camera, and texture bounds, none of which the
 * clipboard knows about.
 */
export interface DecodedSelection {
  width: number;
  height: number;
  pixels: RGBA[];
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
   * Base64 row-major RGBA. Optional because the field postdates v1 readers.
   * When present it supersedes the PNG, which round-trips through a
   * premultiplying canvas and so cannot preserve partial alpha exactly.
   */
  pixels?: string;
}

/**
 * Matches the read/write surface of the browser Clipboard API.
 */
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
  pixels: RGBA[];
}

export type RasterBlobDecoder = (
  blob: Blob
) => Promise<DecodedRasterImage>;

export type SelectionPngEncoder = (
  snapshot: SelectionSnapshot
) => Promise<Blob>;
