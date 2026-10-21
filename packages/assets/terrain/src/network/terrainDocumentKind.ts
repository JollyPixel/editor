// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type SyncedCommandDocument
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { TERRAIN_KIND } from "../asset/terrain.ts";
import { TerrainDocument } from "../model/TerrainDocument.ts";
import { terrainWriteKeys } from "./TerrainCommandKeys.ts";

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
  return commandDocumentKind({
    kind: TERRAIN_KIND,
    createDocument: () => new TerrainDocument(),
    keys: terrainWriteKeys
  });
}
