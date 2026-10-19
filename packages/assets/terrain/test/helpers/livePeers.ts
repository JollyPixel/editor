// Import Third-party Dependencies
import { DocumentSyncClient } from "@jolly-pixel/network/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  TileCoord,
  type TerrainDocument,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TerrainCommandDocument,
  TerrainInterest,
  TerrainLiveSync,
  terrainAssetKind,
  type TerrainNetworkCommand,
  type TerrainServerMessage
} from "#src/index.ts";
import { terrainWriteKeys } from "#src/network/TerrainCommandKeys.ts";
import { LiveRoom } from "./liveRoom.ts";
import {
  createMockRoom,
  type MockRoom
} from "./room.ts";
import { tileHeights } from "./terrain.ts";

// CONSTANTS
export const LIVE_TILE = new TileCoord(new ChunkCoord(0, 0), 1, 1);

export interface LivePeer {
  readonly room: MockRoom;
  readonly document: TerrainCommandDocument;
  readonly live: TerrainLiveSync;
  sculpt(height: number): TilePatch[];
  height(): number;
}

export function livePeerSetup() {
  const server = new LiveRoom<TerrainDocument, TerrainNetworkCommand>(
    terrainAssetKind()
  );
  const peers = new Map<string, LivePeer>();

  function route(): void {
    for (const [clientId, { room }] of peers) {
      for (const sent of room.sent.splice(0)) {
        server.receive(clientId, sent);
      }
    }
    for (const [clientId, { room }] of peers) {
      for (const message of server.take(clientId)) {
        room.deliver(message as TerrainServerMessage);
      }
    }
  }

  function join(
    clientId: string,
    chunkX: number
  ): LivePeer {
    const room = createMockRoom(clientId);
    const document = new TerrainCommandDocument();
    new DocumentSyncClient(room, { document, keys: terrainWriteKeys });
    const live = new TerrainLiveSync({ room, document });
    const peer: LivePeer = {
      room,
      document,
      live,
      sculpt(height) {
        const previous = document.writeTiles([{ tile: LIVE_TILE, heights: tileHeights(height) }]);
        live.queue([LIVE_TILE]);

        return previous;
      },
      height() {
        return document.terrain.chunk(LIVE_TILE.chunk)!.tileHeights(LIVE_TILE.x, LIVE_TILE.z)[0];
      }
    };
    peers.set(clientId, peer);
    server.connect(clientId);
    live.publishInterest(TerrainInterest.around(chunkX * CHUNK_SAMPLES, 0, 1));
    route();

    return peer;
  }

  return {
    server,
    join,
    route
  };
}
