// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { DocumentSyncClient } from "@jolly-pixel/network/client";
import {
  ChunkCoord,
  type TerrainDocument
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
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
  networkCommand
} from "../helpers/terrain.ts";

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
});
