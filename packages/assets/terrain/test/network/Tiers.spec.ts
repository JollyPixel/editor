// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  resampleHeights,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeHeights,
  encodeTilePatch,
  terrainAssetKind,
  terrainSnapshot
} from "#src/index.ts";
import { historySetup } from "../helpers/history.ts";
import {
  EDGE_TILE,
  edgePeerSetup
} from "../helpers/peers.ts";
import {
  holeTile,
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kChunk = EDGE_TILE.chunk;
const kRefinedTile = new TileCoord(kChunk, 0, 4, 2);

function refineCommand(
  terrain: TerrainReader
) {
  return {
    action: "tier-changed" as const,
    x: kChunk.x,
    z: kChunk.z,
    tier: 2 as const,
    heights: encodeHeights(resampleHeights(terrain, kChunk, 2))
  };
}

describe("terrain tiers", () => {
  test("a refinement reaches the room at x2 and undoes back to the x1 heights and holes", () => {
    const { history, document, server, route, sculpt } = historySetup();
    sculpt(3);
    document.patchHoles([{ tile: EDGE_TILE, holes: holeTile(true) }]);
    route();
    const original = server.state.terrain.chunk(kChunk)!;
    const heights = original.copyHeights();
    const holes = original.holes.copy();

    history.record("terrain", null, () => document.changeTier(kChunk.x, kChunk.z, 2));
    route();
    const refined = server.state.terrain.chunk(kChunk)!;
    assert.equal(refined.tier, 2);
    assert.equal(refined.holes.isHole(1, 65), true);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));

    assert.equal(history.undo("terrain"), true);
    route();
    const restored = server.state.terrain.chunk(kChunk)!;
    assert.deepEqual([restored.tier, restored.copyHeights(), restored.holes.copy()], [1, heights, holes]);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("a x1 sculpt crossing a peer's refinement settles on the x2 chunk without a snapshot", () => {
    const { server, document, sculpt, route } = edgePeerSetup();
    let resets = 0;
    document.on("reset", () => resets++);
    sculpt(5);
    server.receive("A", networkCommand(refineCommand(server.state.terrain), { clientId: "A" }));
    route();

    assert.equal(document.terrain.chunk(kChunk)!.tier, 2);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
    assert.equal(resets, 0);
  });

  test("undoing a refinement is skipped once a peer has sculpted the refined chunk", () => {
    const { history, document, server, route, skipped } = historySetup();
    history.record("terrain", null, () => document.changeTier(kChunk.x, kChunk.z, 2));
    route();
    const patch = encodeTilePatch({ tile: kRefinedTile, heights: tileHeights(-2) });
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [patch] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));
    route();

    assert.equal(document.terrain.chunk(kChunk)!.tileHeights(0, 4)[0], -2);
    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("a refined chunk's heights and holes round-trip through its parts in any order", async() => {
    const handler = terrainAssetKind();
    const { server, document, route } = edgePeerSetup();
    document.patchHoles([{ tile: EDGE_TILE, holes: holeTile(true) }]);
    document.changeTier(kChunk.x, kChunk.z, 4);
    route();

    const manifest = await handler.serialize(server.state);
    const partIds = [...handler.parts!.list(manifest)];
    for (const order of [partIds, partIds.toReversed()]) {
      const loaded = handler.create("copy");
      handler.load(loaded, manifest);
      for (const partId of order) {
        handler.parts!.load(loaded, partId, await handler.parts!.serialize(server.state, partId));
      }

      assert.deepEqual(terrainSnapshot(loaded), terrainSnapshot(server.state));
    }
  });
});
