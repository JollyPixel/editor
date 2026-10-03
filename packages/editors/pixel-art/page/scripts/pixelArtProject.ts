// Import Third-party Dependencies
import type { OfflineProject } from "@jolly-pixel/editor.host";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";

// CONSTANTS
export const TEXTURE_SIZE = {
  x: 64,
  y: 64
};

export function createPixelArtProject(): Omit<OfflineProject, "handlers"> {
  return {
    seed: {
      "textures/texture.pixelart": {
        id: crypto.randomUUID(),
        kind: PIXEL_ART_KIND
      }
    }
  };
}
