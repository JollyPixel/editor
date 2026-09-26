// Import Third-party Dependencies
import type { TilesetAssetReference } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { TILESET_KIND } from "./kind.ts";

export function tilesetAsset(
  assetId: string
): TilesetAssetReference {
  return {
    id: assetId,
    kind: TILESET_KIND
  };
}
