// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import {
  encodeTilesetDocument,
  TILESET_KIND,
  type TilesetAssetDocument
} from "../../asset/tileset.ts";
import type { TilesetRoom } from "./types.ts";

export type TilesetAssetWriter = Pick<CatalogClient, "create">;

export interface TilesetRoomSource {
  room(name: string): TilesetRoom;
}

export function tilesetRoom(
  client: TilesetRoomSource,
  assetId: string
): TilesetRoom {
  return client.room(
    new AssetRoom(TILESET_KIND, assetId).toString()
  );
}

export function createTilesetAsset(
  catalog: TilesetAssetWriter,
  path: string,
  document: TilesetAssetDocument
): Promise<string> {
  return catalog.create(
    path,
    encodeTilesetDocument(document),
    {
      kind: TILESET_KIND,
      onConflict: "suffix"
    }
  );
}
