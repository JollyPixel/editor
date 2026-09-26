// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import { AssetRoom } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  encodePixelArtDocument,
  type PixelArtDocumentData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../asset/pixelArt.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

export type PixelArtRoom = Room<PixelNetworkCommand, PixelServerMessage>;
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
  document: PixelArtDocumentData
): Promise<string> {
  return catalog.create(
    path,
    encodePixelArtDocument(document),
    {
      kind: PIXEL_ART_KIND,
      onConflict: "suffix"
    }
  );
}
