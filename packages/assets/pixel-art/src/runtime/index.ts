// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { ThreeComponentPackage } from "@jolly-pixel/backend.three";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../asset/pixelArt.ts";
import { PixelArtDocumentLoader } from "./PixelArtDocumentLoader.ts";

export { pixelArtDocument } from "./pixelArtDocument.ts";
export * from "./mesh-texturing/index.ts";

// CONSTANTS
export const PIXEL_ART_DOCUMENT = new AssetType<PixelDocument>(PIXEL_ART_KIND);

export const RUNTIME_COMPONENTS: ThreeComponentPackage = {
  definitions: [],
  loaders: [
    {
      type: PIXEL_ART_DOCUMENT,
      create: (manager) => new PixelArtDocumentLoader(manager)
    }
  ]
};
