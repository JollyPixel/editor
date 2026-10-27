// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  encodePixelArtFile,
  type PixelArtFile
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../asset/pixelArt.ts";

export type PixelArtAssetWriter = Pick<CatalogClient, "create">;

export function createPixelArtAsset(
  catalog: PixelArtAssetWriter,
  path: string,
  file: PixelArtFile
): Promise<string> {
  return catalog.create(
    path,
    encodePixelArtFile(file),
    {
      kind: PIXEL_ART_KIND,
      onConflict: "suffix"
    }
  );
}
