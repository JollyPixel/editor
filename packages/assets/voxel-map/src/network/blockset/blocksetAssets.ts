// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import {
  encodeBlocksetDocument,
  BLOCKSET_KIND,
  type BlocksetAssetDocument
} from "../../asset/blockset.ts";
import type { BlocksetRoom } from "./types.ts";

export type BlocksetAssetWriter = Pick<CatalogClient, "create">;

export interface BlocksetRoomSource {
  room(name: string): BlocksetRoom;
}

export function blocksetRoom(
  client: BlocksetRoomSource,
  assetId: string
): BlocksetRoom {
  return client.room(
    new AssetRoom(BLOCKSET_KIND, assetId).toString()
  );
}

export function createBlocksetAsset(
  catalog: BlocksetAssetWriter,
  path: string,
  document: BlocksetAssetDocument
): Promise<string> {
  return catalog.create(
    path,
    encodeBlocksetDocument(document),
    {
      kind: BLOCKSET_KIND,
      onConflict: "suffix"
    }
  );
}
