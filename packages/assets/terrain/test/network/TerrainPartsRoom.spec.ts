// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { mockAssetRoom } from "@jolly-pixel/asset-server/testing";
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  type TerrainNetworkCommand,
  type TerrainSnapshot
} from "#src/index.ts";
import { terrainDocumentKind } from "#src/network/client.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kTile = new TileCoord(new ChunkCoord(0, 0), 1, 1);

function joinedPeer() {
  const room = mockAssetRoom<TerrainNetworkCommand, TerrainSnapshot>("A");
  const { document } = terrainDocumentKind().syncDocument(room);

  return {
    room,
    document,
    deliver: (message: unknown) => room.deliver(message as never)
  };
}

function manifest(
  version: number
): unknown {
  return {
    type: "snapshot",
    data: { chunks: [{ x: 0, z: 0 }] },
    version
  };
}

function parts(
  version: number,
  height: number
): unknown {
  return {
    type: "parts",
    version,
    parts: { "0_0": heights(height) }
  };
}

describe("TerrainPartsRoom", () => {
  test("loads the document once its chunks arrive, then the messages held meanwhile", () => {
    const { room, document, deliver } = joinedPeer();

    deliver(manifest(1));
    deliver({
      type: "command",
      data: networkCommand(
        { action: "heights-patched", tiles: [encodeTilePatch({ tile: kTile, heights: tileHeights(9) })] },
        { clientId: "B" }
      ),
      version: 2
    });
    assert.deepEqual(room.sent, [{ action: "subscribe-parts", parts: ["0_0"] }]);
    assert.equal(document.terrain.size, 0);

    deliver(parts(2, 4));

    const chunk = document.terrain.chunk(new ChunkCoord(0, 0))!;
    assert.deepEqual(chunk.tileHeights(kTile.x, kTile.z), tileHeights(9));
    assert.equal(chunk.height(0, 0), 4);
  });

  test("a later snapshot waits for the parts the room sends again, without subscribing twice", () => {
    const { room, document, deliver } = joinedPeer();
    deliver(manifest(1));
    deliver(parts(1, 4));

    deliver(manifest(3));
    assert.equal(document.terrain.chunk(new ChunkCoord(0, 0))!.height(0, 0), 4);
    deliver(parts(3, 7));

    assert.equal(room.sent.length, 1);
    assert.equal(document.terrain.chunk(new ChunkCoord(0, 0))!.height(0, 0), 7);
  });
});
