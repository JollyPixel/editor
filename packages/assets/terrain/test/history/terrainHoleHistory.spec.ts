// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { terrainSnapshot } from "#src/index.ts";
import { historySetup } from "../helpers/history.ts";
import { EDGE_TILE } from "../helpers/peers.ts";
import {
  cutHoles,
  holeTile,
  networkCommand
} from "../helpers/terrain.ts";

describe("terrain hole history", () => {
  test("a cut undoes to the filled tile, skipped once a peer has cut that tile again", () => {
    const { history, document, server, route, skipped } = historySetup();
    function edgeHoles() {
      return server.state.terrain.chunk(EDGE_TILE.chunk)!.holes.tile(EDGE_TILE.x, EDGE_TILE.z);
    }
    history.record("terrain", null, () => document.patchHoles([{ tile: EDGE_TILE, holes: holeTile(true) }]));
    route();
    assert.deepEqual(edgeHoles(), holeTile(true));

    assert.equal(history.undo("terrain"), true);
    route();
    assert.deepEqual(edgeHoles(), holeTile(false));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));

    assert.equal(history.redo("terrain"), true);
    route();
    const cut = cutHoles(EDGE_TILE.chunk.x, EDGE_TILE.chunk.z, { [EDGE_TILE.index]: false });
    server.receive("A", networkCommand(cut, { clientId: "A", timestamp: Date.now() + 1000 }));
    route();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("undoing a chunk's removal brings back its holes", () => {
    const { history, document, server, route } = historySetup();
    document.patchHoles([{ tile: EDGE_TILE, holes: holeTile(true) }]);
    route();
    history.record("terrain", null, () => document.removeChunk(EDGE_TILE.chunk.x, EDGE_TILE.chunk.z));
    route();

    assert.equal(history.undo("terrain"), true);
    route();

    const { holes } = server.state.terrain.chunk(EDGE_TILE.chunk)!;
    assert.deepEqual(holes.tile(EDGE_TILE.x, EDGE_TILE.z), holeTile(true));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });
});
