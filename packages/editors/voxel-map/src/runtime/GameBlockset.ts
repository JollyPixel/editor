// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import { BLOCKSET_KIND } from "@jolly-pixel/asset.voxel-map/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetDocument } from "@jolly-pixel/voxel.renderer";

export interface GameBlockset {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;
}

// CONSTANTS
export const GAME_BLOCKSET = new AssetType<GameBlockset>(BLOCKSET_KIND);
