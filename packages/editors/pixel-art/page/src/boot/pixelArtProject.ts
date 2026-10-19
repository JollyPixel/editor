// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";

// CONSTANTS
export const TEXTURE_SIZE = {
  x: 64,
  y: 64
};

export function createPixelArtSeed(
  textureId: string = crypto.randomUUID()
): AssetSeedMap {
  return {
    "textures/texture.pixelart": {
      id: textureId,
      kind: PIXEL_ART_KIND
    }
  };
}
