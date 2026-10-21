// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  encodePixelArtFile,
  type PixelArtFile
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../asset/pixelArt.ts";
import type { PixelArtRoom } from "./types.ts";

export type PixelArtAssetWriter = Pick<CatalogClient, "create">;

export interface PixelArtRoomSource {
  room(name: string): PixelArtRoom;
}

export function pixelArtRoom(
  client: PixelArtRoomSource,
  assetId: string
): PixelArtRoom {
  return client.room(
    new AssetRoom(PIXEL_ART_KIND, assetId).toString()
  );
}

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
