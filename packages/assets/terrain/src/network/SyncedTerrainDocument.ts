// Import Third-party Dependencies
import { SyncedCommandDocument } from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { TERRAIN_KIND } from "../asset/terrain.ts";
import {
  TerrainCommandDocument,
  type TerrainImage
} from "../model/TerrainCommandDocument.ts";
import { terrainWriteKeys } from "./TerrainCommandKeys.ts";
import type {
  TerrainNetworkCommand,
  TerrainRoom,
  TerrainSnapshot
} from "./types.ts";

export class SyncedTerrainDocument extends SyncedCommandDocument<
  TerrainCommandDocument,
  TerrainNetworkCommand,
  TerrainSnapshot,
  AssetRoomNotice,
  TerrainImage
> {
  constructor(
    room: TerrainRoom
  ) {
    super(room, {
      document: new TerrainCommandDocument(),
      keys: terrainWriteKeys
    });
  }
}

export interface TerrainDocumentKind {
  readonly kind: typeof TERRAIN_KIND;
  createDocument(
    room: TerrainRoom
  ): SyncedTerrainDocument;
}

export function terrainDocumentKind(): TerrainDocumentKind {
  return {
    kind: TERRAIN_KIND,
    createDocument: (room) => new SyncedTerrainDocument(room)
  };
}
