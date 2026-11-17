// Import Third-party Dependencies
import type { GolemKindList } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import type { PixelArtAsset } from "./PixelArtAsset.ts";
import { PIXEL_ART_GOLEM_KIND } from "./pixelArtGolemKind.ts";

export * from "./PixelArtAsset.ts";
export * from "./PixelSurface.ts";
export * from "./pixelCursor.ts";
export * from "./pixelIntents.ts";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    pixelart: PixelArtAsset;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  PIXEL_ART_GOLEM_KIND
];
