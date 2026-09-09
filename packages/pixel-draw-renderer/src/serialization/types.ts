// Import Internal Dependencies
import type { UVRegionData } from "../uv/UVRegion.ts";
import type { Vec2 } from "../types.ts";

export const PIXEL_ART_DOCUMENT_VERSION = 1;

export interface PixelBufferSnapshot {
  size: Vec2;
  /**
   * Base64-encoded RGBA8 data.
   */
  pixels: string;
  uvRegions: UVRegionData[];
}

export interface PixelArtDocumentData extends PixelBufferSnapshot {
  readonly version: typeof PIXEL_ART_DOCUMENT_VERSION;
}
