// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { PixelArtDocumentLoader } from "./PixelArtDocumentLoader.ts";

export { pixelArtDocument } from "./pixelArtDocument.ts";

// CONSTANTS
export const PIXEL_ART_DOCUMENT = new AssetType<PixelDocument>(PIXEL_ART_KIND);

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [],
  loaders: [
    {
      type: PIXEL_ART_DOCUMENT,
      create: (manager) => new PixelArtDocumentLoader(manager)
    }
  ]
};
