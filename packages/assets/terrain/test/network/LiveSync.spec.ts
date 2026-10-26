// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  TerrainInterest,
  terrainSnapshot
} from "#src/index.ts";
import {
  LIVE_PATCH_INTERVAL,
  LIVE_PATCH_TIMEOUT,
  type TerrainStroke
} from "#src/network/client.ts";
import { MAX_PATCH_TILES } from "#src/network/TerrainCommand.schema.ts";
import {
  addWideChunkBlock,
  terrainPeers,
  WIDE_BLOCK_CENTRE,
  type JoinOptions,
  type TerrainPeer
} from "../helpers/peers.ts";
import {
  heights,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kLiveTile = new TileCoord(new ChunkCoord(0, 0), 1, 1);
const kOtherTile = new TileCoord(kLiveTile.chunk, 2, 2);
const kPendingTile = new TileCoord(kLiveTile.chunk, 3, 3);
const kRemoteTile = new TileCoord(kLiveTile.chunk, 0, 3);
const kRemovedTile = new TileCoord(new ChunkCoord(1, 0), 0, 0);

interface LivePeer extends TerrainPeer {
  readonly stroke: TerrainStroke;
  sculpt(height: number): void;
  height(): number | undefined;
  confirmedHeight(): number | undefined;
}

function livePeers(
  t: TestContext
) {
  const { server, join, route, dispose } = terrainPeers();
  t.after(dispose);

  function joinLive(
    clientId: string,
    chunkX: number,
    options: Omit<JoinOptions, "interestChunkX"> = {}
  ): LivePeer {
    const peer = join(clientId, { ...options, interestChunkX: chunkX });
    const stroke = peer.preview.beginStroke();

    return {
      ...peer,
      stroke,
      sculpt(height) {
        stroke.write([{ tile: kLiveTile, heights: tileHeights(height) }]);
      },
      height: () => tileHeightIn(peer.preview.terrain),
      confirmedHeight: () => tileHeightIn(peer.document.terrain)
    };
  }

  return {
    server,
    join: joinLive,
    route
  };
}

function heightIn(
  terrain: TerrainPeer["document"]["terrain"],
  tile: TileCoord
): number | undefined {
  return terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z)[0];
}

function tileHeightIn(
  terrain: TerrainPeer["document"]["terrain"]
): number | undefined {
  return heightIn(terrain, kLiveTile);
}

describe("terrain live patches", () => {
  test("reach a peer whose interest overlaps the tiles, not a far peer, and stay out of documents", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, join, route } = livePeers(t);
    const author = join("A", 0);
    const near = join("B", 1);
    const far = join("C", 5);
    const saved = terrainSnapshot(server.state);

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();

    assert.equal(near.height(), 12);
    assert.equal(near.confirmedHeight(), 0);
    assert.equal(far.height(), 0);
    assert.equal(author.confirmedHeight(), 0);
    assert.deepEqual(terrainSnapshot(server.state), saved);
  });

  test("wider than one message's tile limit reach peers near either end of the stroke", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, join, route } = livePeers(t);
    const tiles = addWideChunkBlock(server);
    const first = tiles[0];
    const last = tiles[tiles.length - 1];
    const streamCentre = WIDE_BLOCK_CENTRE;
    const author = join("A", 0, { streamCentre });
    const nearFirst = join("B", first.chunk.x, { interestChunkZ: first.chunk.z, streamCentre });
    const nearLast = join("C", last.chunk.x, { interestChunkZ: last.chunk.z, streamCentre });

    author.stroke.write(tiles.map((tile) => {
      return { tile, heights: tileHeights(9) };
    }));
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    assert.ok(author.room.sent.every((sent) => !("tiles" in sent) ||
      sent.tiles.length <= MAX_PATCH_TILES));
    route();

    assert.equal(heightIn(nearFirst.preview.terrain, first), 9);
    assert.equal(heightIn(nearLast.preview.terrain, last), 9);
  });

  test("give way to the stroke commit, which outlives the live timeout", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, join, route } = livePeers(t);
    const author = join("A", 0);
    const near = join("B", 0);

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    author.sculpt(20);
    author.stroke.commit();
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);

    assert.deepEqual(author.room.sent.map((sent) => sent.action), ["heights-patched"]);
    route();
    t.mock.timers.tick(LIVE_PATCH_TIMEOUT);

    assert.equal(near.height(), 20);
    assert.equal(tileHeightIn(server.state.terrain), 20);
  });

  test("fall back to the confirmed heights when no commit arrives in time", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { join, route } = livePeers(t);
    const author = join("A", 0);
    const near = join("B", 0);
    const changed: unknown[] = [];
    near.preview.on("tilesChanged", (tiles) => changed.push(tiles));

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    t.mock.timers.tick(LIVE_PATCH_TIMEOUT);

    assert.equal(near.height(), 0);
    assert.deepEqual(changed, [[kLiveTile], [kLiveTile]]);
  });

  test("fall back to the confirmed heights when the author leaves mid-stroke", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { join, route } = livePeers(t);
    const author = join("A", 0);
    const near = join("B", 0);

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    near.room.emit("peer-left", { clientId: "A" });

    assert.equal(near.height(), 0);
  });

  test("survive a rebase rewind without becoming confirmed heights, beside the local stroke", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, join, route } = livePeers(t);
    server.receive("X", networkCommand(
      { action: "chunk-added", x: 1, z: 0, heights: heights(0) },
      { clientId: "X" }
    ));
    const author = join("A", 0);
    const near = join("B", 0);
    const atRewind: Array<Array<number | undefined>> = [];
    near.document.on("reset", (cause) => {
      if (cause === "rewind") {
        atRewind.push([
          near.confirmedHeight(),
          near.height(),
          heightIn(near.preview.terrain, kOtherTile)
        ]);
      }
    });
    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    near.stroke.write([{ tile: kOtherTile, heights: tileHeights(7) }]);

    near.document.patchTiles([{ tile: kRemovedTile, heights: tileHeights(1) }]);
    near.document.patchTiles([{ tile: kPendingTile, heights: tileHeights(2) }]);
    server.receive("X", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "X" }));
    server.receive("X", networkCommand(
      { action: "heights-patched", tiles: [encodeTilePatch({ tile: kRemoteTile, heights: tileHeights(3) })] },
      { clientId: "X" }
    ));
    route();

    assert.deepEqual(atRewind, [[0, 12, 7]]);
    assert.equal(near.height(), 12);
    assert.equal(near.stroke.commit(), true);
    assert.equal(heightIn(near.document.terrain, kOtherTile), 7);
  });

  test("resend the interest region when the room syncs again", (t) => {
    const { join } = livePeers(t);
    const peer = join("A", 0);
    peer.sender.publishInterest(TerrainInterest.around(0, 0, 1));
    assert.equal(peer.room.sent.length, 0);

    peer.room.emit("sync", { self: "A", clientIds: [] });

    assert.deepEqual(peer.room.sent, [{
      action: "interest-changed",
      x: 0,
      z: 0,
      radius: 1
    }]);
  });
});
