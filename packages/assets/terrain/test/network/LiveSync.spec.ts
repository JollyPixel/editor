// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  LIVE_PATCH_INTERVAL,
  LIVE_PATCH_TIMEOUT,
  TerrainInterest,
  terrainSnapshot
} from "#src/index.ts";
import {
  LIVE_TILE,
  livePeerSetup
} from "../helpers/livePeers.ts";

describe("terrain live patches", () => {
  test("reach a peer whose interest overlaps the tiles, not a far peer, and stay out of the asset", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, join, route } = livePeerSetup();
    const author = join("A", 0);
    const near = join("B", 1);
    const far = join("C", 5);
    const saved = terrainSnapshot(server.state);

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();

    assert.equal(near.height(), 12);
    assert.equal(far.height(), 0);
    assert.deepEqual(terrainSnapshot(server.state), saved);
  });

  test("give way to the stroke commit, which outlives the live timeout", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { server, join, route } = livePeerSetup();
    const author = join("A", 0);
    const near = join("B", 0);

    const previous = author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    author.sculpt(20);
    author.document.commitTiles(previous);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);

    assert.deepEqual(author.room.sent.map((sent) => sent.action), ["heights-patched"]);
    route();
    t.mock.timers.tick(LIVE_PATCH_TIMEOUT);

    assert.equal(near.height(), 20);
    assert.equal(server.state.chunk(LIVE_TILE.chunk)!.tileHeights(LIVE_TILE.x, LIVE_TILE.z)[0], 20);
  });

  test("fall back to the confirmed heights when no commit arrives in time", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { join, route } = livePeerSetup();
    const author = join("A", 0);
    const near = join("B", 0);
    const changed: unknown[] = [];
    near.live.on("tilesChanged", (tiles) => changed.push(tiles));

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    t.mock.timers.tick(LIVE_PATCH_TIMEOUT);

    assert.equal(near.height(), 0);
    assert.deepEqual(changed, [[LIVE_TILE], [LIVE_TILE]]);
  });

  test("fall back to the confirmed heights when the author leaves mid-stroke", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { join, route } = livePeerSetup();
    const author = join("A", 0);
    const near = join("B", 0);

    author.sculpt(12);
    t.mock.timers.tick(LIVE_PATCH_INTERVAL);
    route();
    near.room.emit("peer-left", { clientId: "A" });

    assert.equal(near.height(), 0);
  });

  test("resend the interest region when the room syncs again", () => {
    const { join } = livePeerSetup();
    const peer = join("A", 0);
    peer.live.publishInterest(TerrainInterest.around(0, 0, 1));
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
