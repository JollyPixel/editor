// Import Third-party Dependencies
import {
  SyncedCommandDocument,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { TERRAIN_KIND } from "../asset/terrain.ts";
import { TerrainDocument } from "../model/TerrainDocument.ts";
import { terrainWriteKeys } from "./TerrainCommandKeys.ts";
import { TerrainPartsRoom } from "./TerrainPartsRoom.ts";

export type SyncedTerrainDocument = SyncedCommandDocument<
  TerrainDocument,
  AssetRoomNotice
>;

export type TerrainDocumentKind = CommandDocumentKind<
  typeof TERRAIN_KIND,
  TerrainDocument,
  AssetRoomNotice
>;

export function terrainDocumentKind(): TerrainDocumentKind {
  return {
    kind: TERRAIN_KIND,
    syncDocument: (room) => new SyncedCommandDocument(
      new TerrainPartsRoom(room),
      {
        document: new TerrainDocument(),
        keys: terrainWriteKeys
      }
    )
  };
}
