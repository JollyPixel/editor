// Import Third-party Dependencies
import type { OfflineProject } from "@jolly-pixel/editor.host";
import {
  PIXEL_ART_KIND,
  pixelArtAssetKind
} from "@jolly-pixel/asset.pixel-art";

// CONSTANTS
const kTextureSize = {
  x: 64,
  y: 64
};

export function createPixelArtProject(): OfflineProject {
  return {
    handlers: [
      pixelArtAssetKind({
        defaultSize: kTextureSize
      })
    ],
    seed: {
      "textures/texture.pixelart": {
        id: crypto.randomUUID(),
        kind: PIXEL_ART_KIND
      }
    }
  };
}
