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
const kWideBlockChunks = Math.floor(MAX_PATCH_TILES / kChunkTiles) + 1;
const kWideBlockColumns = 9;

export const WIDE_BLOCK_CENTRE = new ChunkCoord(4, 4);

export interface TerrainPeer {
  readonly room: MockAssetRoom<TerrainNetworkCommand, TerrainSnapshot>;
  readonly document: TerrainDocument;
  readonly preview: TerrainPreview;
  readonly sender: TerrainLiveSender;
  readonly receiver: TerrainLiveReceiver;
}

export interface JoinOptions {
  interestChunkX?: number;
  /**
   * @default 0
   */
  interestChunkZ?: number;
  /**
   * Chunk the peer's stream follows.
   * @default (0, 0)
   */
  streamCentre?: ChunkCoord;
}

export function terrainPeers() {
  const server = new LiveAssetRoom(terrainAssetKind());
  const peers = new Map<string, TerrainPeer>();

  async function route(): Promise<void> {
    let delivered = true;
    while (delivered) {
      delivered = false;
      for (const [clientId, { room }] of peers) {
        for (const sent of room.sent.splice(0)) {
          await server.receive(clientId, sent);
        }
      }
      for (const [clientId, { room }] of peers) {
        for (const message of server.take<TerrainSnapshot>(clientId)) {
          room.deliver(message);
          delivered = true;
        }
      }
    }
  }

  async function join(
    clientId: string,
    options: JoinOptions = {}
  ): Promise<TerrainPeer> {
    const {
      interestChunkX,
      interestChunkZ = 0,
      streamCentre = new ChunkCoord(0, 0)
    } = options;
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
    document.stream.follow(streamCentre);
    await server.connect(clientId);
    if (interestChunkX !== undefined) {
      sender.publishInterest(
        TerrainInterest.around(interestChunkX * CHUNK_SAMPLES, interestChunkZ * CHUNK_SAMPLES, 1)
      );
    }
    await route();

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

export async function edgePeerSetup() {
  const peers = terrainPeers();
  await peers.server.receive("A", networkCommand(
    { action: "chunk-added", x: 1, z: 0, heights: heights(8) },
    { clientId: "A" }
  ));
  const peer = await peers.join("B");

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

export async function addWideChunkBlock(
  server: ReturnType<typeof terrainPeers>["server"]
): Promise<TileCoord[]> {
  const tiles: TileCoord[] = [];
  for (let index = 0; index < kWideBlockChunks; index++) {
    const chunk = new ChunkCoord(index % kWideBlockColumns, 1 + Math.floor(index / kWideBlockColumns));
    await server.receive("X", networkCommand(
      { action: "chunk-added", x: chunk.x, z: chunk.z, heights: heights(0) },
      { clientId: "X" }
    ));
    for (let index = 0; index < kChunkTiles; index++) {
      tiles.push(TileCoord.fromIndex(chunk, index));
    }
  }

  return tiles;
}
