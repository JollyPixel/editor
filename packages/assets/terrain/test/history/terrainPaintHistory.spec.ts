// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { terrainSnapshot } from "#src/index.ts";
import {
  historySetup,
  peerTile
} from "../helpers/history.ts";
import { EDGE_TILE } from "../helpers/peers.ts";
import {
  networkCommand,
  paint,
  splatTile
} from "../helpers/terrain.ts";

describe("terrain paint history", () => {
  test("a paint step undoes to the previous splat, skipped if a peer painted its tile, not sculpted", () => {
    const { history, document, server, route, skipped } = historySetup();
    function edgeSplat() {
      return document.terrain.chunk(EDGE_TILE.chunk)!.splat.tile(EDGE_TILE.x, EDGE_TILE.z);
    }
    history.record("terrain", null, () => document.patchSplat([{ tile: EDGE_TILE, splat: splatTile(3) }]));
    route();
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [peerTile(EDGE_TILE, 6)] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));
    route();

    assert.equal(history.undo("terrain"), true);
    route();
    assert.deepEqual(edgeSplat(), splatTile(0));
    assert.equal(document.terrain.chunk(EDGE_TILE.chunk)!.tileHeights(EDGE_TILE.x, EDGE_TILE.z)[0], 6);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));

    history.record("terrain", null, () => document.patchSplat([{ tile: EDGE_TILE, splat: splatTile(3) }]));
    route();
    server.receive("A", networkCommand(
      paint(EDGE_TILE.chunk.x, EDGE_TILE.chunk.z, { [EDGE_TILE.index]: 8 }),
      { clientId: "A", timestamp: Date.now() + 2000 }
    ));
    route();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("undoing a chunk's removal brings back its paint", () => {
    const { history, document, server, route } = historySetup();
    document.patchSplat([{ tile: EDGE_TILE, splat: splatTile(5) }]);
    route();
    history.record("terrain", null, () => document.removeChunk(EDGE_TILE.chunk.x, EDGE_TILE.chunk.z));
    route();

    assert.equal(history.undo("terrain"), true);
    route();

    const { splat } = server.state.terrain.chunk(EDGE_TILE.chunk)!;
    assert.deepEqual(splat.tile(EDGE_TILE.x, EDGE_TILE.z), splatTile(5));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });
});
