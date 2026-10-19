// Import Third-party Dependencies
import { DocumentSyncClient } from "@jolly-pixel/network/client";
import {
  ChunkCoord,
  TileCoord,
  type TerrainDocument
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TerrainCommandDocument,
  terrainAssetKind,
  type TerrainNetworkCommand,
  type TerrainServerMessage
} from "#src/index.ts";
import { terrainWriteKeys } from "#src/network/TerrainCommandKeys.ts";
import { LiveRoom } from "./liveRoom.ts";
import { createMockRoom } from "./room.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "./terrain.ts";

// CONSTANTS
export const EDGE_TILE = new TileCoord(new ChunkCoord(1, 0), 0, 2);
export const ORIGIN_TILE = new TileCoord(new ChunkCoord(0, 0), 3, 2);

export function peerSetup() {
  const server = new LiveRoom<TerrainDocument, TerrainNetworkCommand>(
    terrainAssetKind()
  );
  server.receive("A", networkCommand(
    { action: "chunk-added", x: 1, z: 0, heights: heights(8) },
    { clientId: "A" }
  ));

  const room = createMockRoom("B");
  const document = new TerrainCommandDocument();
  new DocumentSyncClient(room, { document, keys: terrainWriteKeys });

  function sculpt(height: number, tiles = [EDGE_TILE]): boolean {
    return document.commitTiles(
      document.writeTiles(tiles.map((tile) => {
        return { tile, heights: tileHeights(height) };
      }))
    );
  }

  function deliver(): void {
    for (const message of server.take("B")) {
      room.deliver(message as TerrainServerMessage);
    }
  }

  server.connect("B");
  deliver();

  return {
    server,
    document,
    deliver,
    sculpt,
    flush(): void {
      for (const sent of room.sent.splice(0)) {
        server.receive("B", sent);
      }
    }
  };
}
