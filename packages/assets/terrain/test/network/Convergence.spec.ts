// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  terrainSnapshot
} from "#src/index.ts";
import { TerrainPreview } from "#src/network/client.ts";
import {
  EDGE_TILE,
  ORIGIN_TILE,
  edgePeerSetup
} from "../helpers/peers.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

describe("terrain convergence", () => {
  test("a client starts from the room snapshot", () => {
    const { server, document } = edgePeerSetup();

    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a chunk added by a client lands on the server with its seeded edge", () => {
    const { server, document, route } = edgePeerSetup();

    assert.equal(document.addChunk(2, 0), true);
    route();

    const added = server.state.chunk(new ChunkCoord(2, 0));
    assert.ok(added?.copyHeights().every((height) => height === 8));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a chunk added next to one a peer removed meanwhile is dropped everywhere", () => {
    const { server, document, route } = edgePeerSetup();

    document.addChunk(2, 0);
    server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
    route();

    assert.equal(document.terrain.has(new ChunkCoord(2, 0)), false);
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("two clients adding the same chunk settle on the first one admitted", () => {
    const { server, document, route } = edgePeerSetup();

    document.addChunk(1, 1);
    server.receive("A", networkCommand(
      { action: "chunk-added", x: 1, z: 1, heights: heights(-3) },
      { clientId: "A" }
    ));
    route();

    assert.ok(document.terrain.chunk(new ChunkCoord(1, 1))?.copyHeights().every((height) => height === -3));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a stroke reaches the server as one patch of its final heights", () => {
    const { server, room, document, route } = edgePeerSetup();
    const stroke = new TerrainPreview(document).beginStroke();
    stroke.write([{ tile: EDGE_TILE, heights: tileHeights(2) }]);
    stroke.write([{ tile: EDGE_TILE, heights: tileHeights(5) }]);

    assert.equal(stroke.commit(), true);
    assert.deepEqual(room.sent.map(({ action }) => action), ["heights-patched"]);
    route();

    assert.deepEqual(server.state.chunk(EDGE_TILE.chunk)!.tileHeights(0, 2), tileHeights(5));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("a stroke on a chunk a peer removed meanwhile is refused and the author converges", () => {
    const { server, document, sculpt, route } = edgePeerSetup();
    sculpt(5, [EDGE_TILE, ORIGIN_TILE]);
    server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
    route();

    assert.equal(document.terrain.has(EDGE_TILE.chunk), false);
    assert.deepEqual(document.terrain.chunk(ORIGIN_TILE.chunk)!.tileHeights(3, 2), tileHeights(0));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("two strokes on the same tile settle on the last one admitted", () => {
    const { server, document, sculpt, route } = edgePeerSetup();

    sculpt(5);
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [encodeTilePatch({ tile: EDGE_TILE, heights: tileHeights(-1) })] },
      { clientId: "A" }
    ));
    route();

    assert.deepEqual(document.terrain.chunk(EDGE_TILE.chunk)!.tileHeights(0, 2), tileHeights(5));
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });
});
