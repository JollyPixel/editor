// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { mockAssetRoom } from "@jolly-pixel/asset-server/testing";
import {
  ChunkCoord,
  OVERVIEW_SAMPLE_COUNT,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeHeights,
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
const kNear = new ChunkCoord(0, 0);
const kFar = new ChunkCoord(20, 0);
const kTile = new TileCoord(kNear, 1, 1);

function joinedPeer() {
  const room = mockAssetRoom<TerrainNetworkCommand, TerrainSnapshot>("A");
  const { document } = terrainDocumentKind().syncDocument(room);
  document.stream.follow(kNear);

  return {
    room,
    document,
    deliver: (message: unknown) => room.deliver(message as never)
  };
}

function manifest(
  version: number
): unknown {
  const overview = encodeHeights(new Float32Array(OVERVIEW_SAMPLE_COUNT).fill(2));

  return {
    type: "snapshot",
    data: { chunks: [{ x: kNear.x, z: kNear.z, overview }, { x: kFar.x, z: kFar.z, overview }] },
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

function sculpt(
  version: number,
  height: number
): unknown {
  return {
    type: "command",
    data: networkCommand(
      { action: "heights-patched", tiles: [encodeTilePatch({ tile: kTile, heights: tileHeights(height) })] },
      { clientId: "B" }
    ),
    version
  };
}

describe("TerrainPartsRoom", () => {
  test("a snapshot shows every chunk as an overview and loads those within the stream as they arrive", () => {
    const { room, document, deliver } = joinedPeer();

    deliver(manifest(1));
    assert.deepEqual(room.sent, [{ action: "subscribe-parts", parts: ["0_0"] }]);
    assert.deepEqual([document.terrain.knows(kNear), document.terrain.knows(kFar)], [true, true]);
    assert.equal(document.terrain.size, 0);

    deliver(parts(1, 4));
    assert.equal(document.terrain.chunk(kNear)!.height(0, 0), 4);
    assert.equal(document.terrain.has(kFar), false);
  });

  test("a later snapshot waits for the subscribed chunks, then replays the messages held meanwhile", () => {
    const { room, document, deliver } = joinedPeer();
    deliver(manifest(1));
    deliver(parts(1, 4));

    deliver(manifest(3));
    deliver(sculpt(4, 9));
    assert.equal(document.terrain.chunk(kNear)!.height(0, 0), 4);
    deliver(parts(3, 7));

    const chunk = document.terrain.chunk(kNear)!;
    assert.equal(chunk.height(0, 0), 7);
    assert.deepEqual(chunk.tileHeights(kTile.x, kTile.z), tileHeights(9));
    assert.equal(room.sent.length, 1);
  });

  test("a chunk subscribed while a snapshot is held loads once the snapshot is delivered", () => {
    const { document, deliver } = joinedPeer();
    deliver(manifest(1));
    deliver(parts(1, 4));

    deliver(manifest(3));
    document.stream.follow(kFar);
    deliver({ type: "parts", version: 3, parts: { "20_0": heights(6) } });
    deliver(parts(3, 7));

    assert.equal(document.terrain.chunk(kFar)?.height(0, 0), 6);
    assert.equal(document.terrain.has(kNear), false);
  });

  test("a new connection subscribes again to the chunks the stream follows", () => {
    const { room, deliver } = joinedPeer();
    deliver(manifest(1));
    room.sent.splice(0);

    Object.assign(room, { clientId: "A-2" });
    room.emit("sync", { self: "A-2", clientIds: ["A-2"] });

    assert.deepEqual(room.sent, [{ action: "subscribe-parts", parts: ["0_0"] }]);
  });
});
