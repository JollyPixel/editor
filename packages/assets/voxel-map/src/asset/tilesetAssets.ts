// Import Third-party Dependencies
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { TilesetAssetReference } from "@jolly-pixel/voxel.renderer";

export function tilesetAsset(
  assetId: string
): TilesetAssetReference {
  return {
    id: assetId,
    kind: PIXEL_ART_KIND
  };
}
