// Import Third-party Dependencies
import {
  LiveAssetRoom,
  mockAssetRoom,
  type MockAssetRoom
} from "@jolly-pixel/asset-server/testing";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  TILES_PER_CHUNK,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TerrainInterest,
  terrainAssetKind,
  type TerrainNetworkCommand,
  type TerrainSnapshot
} from "#src/index.ts";
import { MAX_PATCH_TILES } from "#src/network/TerrainCommand.schema.ts";
import {
  TerrainLiveReceiver,
  TerrainLiveSender,
  TerrainPreview,
  terrainDocumentKind,
  type TerrainDocument
} from "#src/network/client.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "./terrain.ts";

// CONSTANTS
export const EDGE_TILE = new TileCoord(new ChunkCoord(1, 0), 0, 2);
export const ORIGIN_TILE = new TileCoord(new ChunkCoord(0, 0), 3, 2);
const kDocumentKind = terrainDocumentKind();
const kChunkTiles = TILES_PER_CHUNK * TILES_PER_CHUNK;
const kWideRowChunks = Math.floor(MAX_PATCH_TILES / kChunkTiles) + 1;

export interface TerrainPeer {
  readonly room: MockAssetRoom<TerrainNetworkCommand, TerrainSnapshot>;
  readonly document: TerrainDocument;
  readonly preview: TerrainPreview;
  readonly sender: TerrainLiveSender;
  readonly receiver: TerrainLiveReceiver;
}

export interface JoinOptions {
  interestChunkX?: number;
}

export function terrainPeers() {
  const server = new LiveAssetRoom(terrainAssetKind());
  const peers = new Map<string, TerrainPeer>();

  function route(): void {
    for (const [clientId, { room }] of peers) {
      for (const sent of room.sent.splice(0)) {
        server.receive(clientId, sent);
      }
    }
    for (const [clientId, { room }] of peers) {
      for (const message of server.take<TerrainSnapshot>(clientId)) {
        room.deliver(message);
      }
    }
  }

  function join(
    clientId: string,
    options: JoinOptions = {}
  ): TerrainPeer {
    const { interestChunkX } = options;
    const room = mockAssetRoom<TerrainNetworkCommand, TerrainSnapshot>(clientId);
    const { document } = kDocumentKind.syncDocument(room);
    const preview = new TerrainPreview(document);
    const sender = new TerrainLiveSender({ room, preview });
    const receiver = new TerrainLiveReceiver({ room, preview });
    const peer: TerrainPeer = {
      room,
      document,
      preview,
      sender,
      receiver
    };
    peers.set(clientId, peer);
    server.connect(clientId);
    if (interestChunkX !== undefined) {
      sender.publishInterest(TerrainInterest.around(interestChunkX * CHUNK_SAMPLES, 0, 1));
    }
    route();

    return peer;
  }

  function dispose(): void {
    for (const { receiver, sender, preview } of peers.values()) {
      receiver.dispose();
      sender.dispose();
      preview.dispose();
    }
    peers.clear();
  }

  return {
    server,
    join,
    route,
    dispose
  };
}

export function edgePeerSetup() {
  const peers = terrainPeers();
  peers.server.receive("A", networkCommand(
    { action: "chunk-added", x: 1, z: 0, heights: heights(8) },
    { clientId: "A" }
  ));
  const peer = peers.join("B");

  function sculpt(
    height: number,
    tiles: TileCoord[] = [EDGE_TILE]
  ): boolean {
    return peer.document.patchTiles(tiles.map((tile) => {
      return { tile, heights: tileHeights(height) };
    }));
  }

  return {
    ...peers,
    ...peer,
    sculpt
  };
}

export function addWideChunkRow(
  server: ReturnType<typeof terrainPeers>["server"]
): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let x = 0; x < kWideRowChunks; x++) {
    const chunk = new ChunkCoord(x, 1);
    server.receive("X", networkCommand(
      { action: "chunk-added", x: chunk.x, z: chunk.z, heights: heights(0) },
      { clientId: "X" }
    ));
    for (let index = 0; index < kChunkTiles; index++) {
      tiles.push(TileCoord.fromIndex(chunk, index));
    }
  }

  return tiles;
}
