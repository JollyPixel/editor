// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { DocumentSyncClient } from "@jolly-pixel/network/client";
import {
  ChunkCoord,
  TileCoord,
  type TerrainDocument
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  TerrainCommandDocument,
  terrainAssetKind,
  terrainSnapshot,
  type TerrainNetworkCommand,
  type TerrainServerMessage
} from "#src/index.ts";
import { terrainWriteKeys } from "#src/network/TerrainCommandKeys.ts";
import { LiveRoom } from "../helpers/liveRoom.ts";
import { createMockRoom } from "../helpers/room.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kEdgeTile = new TileCoord(new ChunkCoord(1, 0), 0, 2);
const kOriginTile = new TileCoord(new ChunkCoord(0, 0), 3, 2);

function setup() {
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

  function sculpt(height: number, tiles = [kEdgeTile]): boolean {
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

describe("terrain convergence", () => {
  test("a client starts from the room snapshot", () => {
    const { server, document } = setup();

    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a chunk added by a client lands on the server with its seeded edge", () => {
    const { server, document, deliver, flush } = setup();

    assert.equal(document.addChunk(2, 0), true);
    flush();
    deliver();

    const added = server.state.chunk(new ChunkCoord(2, 0));
    assert.ok(added?.copyHeights().every((height) => height === 8));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a chunk added next to one a peer removed meanwhile is dropped everywhere", () => {
    const { server, document, deliver, flush } = setup();

    document.addChunk(2, 0);
    server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
    flush();
    deliver();

    assert.equal(document.terrain.has(new ChunkCoord(2, 0)), false);
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("two clients adding the same chunk settle on the first one admitted", () => {
    const { server, document, deliver, flush } = setup();

    document.addChunk(1, 1);
    server.receive("A", networkCommand(
      { action: "chunk-added", x: 1, z: 1, heights: heights(-3) },
      { clientId: "A" }
    ));
    flush();
    deliver();

    assert.ok(document.terrain.chunk(new ChunkCoord(1, 1))?.copyHeights().every((height) => height === -3));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a stroke reaches the server as one patch of its final heights", () => {
    const { server, document, deliver, flush, sculpt } = setup();
    document.writeTiles([{ tile: kEdgeTile, heights: tileHeights(2) }]);

    assert.equal(sculpt(5), true);
    flush();
    deliver();

    assert.deepEqual(server.state.chunk(kEdgeTile.chunk)!.tileHeights(0, 2), tileHeights(5));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a stroke on a chunk a peer removed meanwhile is refused and the author converges", () => {
    const { server, document, deliver, flush, sculpt } = setup();
    sculpt(5, [kEdgeTile, kOriginTile]);
    server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
    flush();
    deliver();

    assert.equal(document.terrain.has(kEdgeTile.chunk), false);
    assert.deepEqual(document.terrain.chunk(kOriginTile.chunk)!.tileHeights(3, 2), tileHeights(0));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("the inverse of a stroke restores the heights from before it", () => {
    const { server, document, deliver, flush, sculpt } = setup();
    const inverses: unknown[] = [];
    document.subscribe("change", (change) => {
      if (change.origin === "local") {
        inverses.push(...change.inverse);
      }
    });
    sculpt(5);
    document.applyStep(inverses[0] as Parameters<typeof document.applyStep>[0], undefined);
    flush();
    deliver();

    assert.deepEqual(server.state.chunk(kEdgeTile.chunk)!.tileHeights(0, 2), tileHeights(8));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("two strokes on the same tile settle on the last one admitted", () => {
    const { server, document, deliver, flush, sculpt } = setup();

    sculpt(5);
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [encodeTilePatch({ tile: kEdgeTile, heights: tileHeights(-1) })] },
      { clientId: "A" }
    ));
    flush();
    deliver();

    assert.deepEqual(document.terrain.chunk(kEdgeTile.chunk)!.tileHeights(0, 2), tileHeights(5));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });
});
