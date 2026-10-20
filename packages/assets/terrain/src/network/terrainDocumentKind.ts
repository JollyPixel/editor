// Import Third-party Dependencies
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type SyncedCommandDocument
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { TERRAIN_KIND } from "../asset/terrain.ts";
import { TerrainCommandDocument } from "../model/TerrainCommandDocument.ts";
import { terrainWriteKeys } from "./TerrainCommandKeys.ts";

export type SyncedTerrainDocument = SyncedCommandDocument<
  TerrainCommandDocument,
  AssetRoomNotice
>;

export type TerrainDocumentKind = CommandDocumentKind<
  typeof TERRAIN_KIND,
  TerrainCommandDocument,
  AssetRoomNotice
>;

export function terrainDocumentKind(): TerrainDocumentKind {
  return commandDocumentKind({
    kind: TERRAIN_KIND,
    createDocument: () => new TerrainCommandDocument(),
    keys: terrainWriteKeys
  });
}
