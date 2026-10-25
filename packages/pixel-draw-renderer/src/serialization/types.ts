// Import Internal Dependencies
import type { UVRegionData } from "../uv/region/UVRegion.ts";
import type { NormalMapData } from "../normal/types.ts";
import type { UVNetSetData } from "../uv/region/UVNetSet.ts";
import type {
  RGBA8,
  Vec2
} from "../types.ts";

export const PIXEL_ART_FILE_VERSION = 1;

export interface PixelBufferSnapshot {
  size: Vec2;
  /**
   * Base64-encoded RGBA8 data.
   */
  pixels: string;
  uvRegions: UVRegionData[];
  normalMap?: NormalMapData;
  palette?: RGBA8[];
  uvNets?: UVNetSetData;
}

export interface PixelArtFile extends PixelBufferSnapshot {
  readonly version: typeof PIXEL_ART_FILE_VERSION;
}
