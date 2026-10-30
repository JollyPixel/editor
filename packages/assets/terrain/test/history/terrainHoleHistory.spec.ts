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
  test("a cut undoes to the filled tile, skipped once a peer has cut that tile again", async() => {
    const { history, document, server, route, skipped } = await historySetup();
    function edgeHoles() {
      return server.state.terrain.chunk(EDGE_TILE.chunk)!.holes.tile(EDGE_TILE.x, EDGE_TILE.z);
    }
    history.record("terrain", null, () => document.patchHoles([{ tile: EDGE_TILE, holes: holeTile(true) }]));
    await route();
    assert.deepEqual(edgeHoles(), holeTile(true));

    assert.equal(history.undo("terrain"), true);
    await route();
    assert.deepEqual(edgeHoles(), holeTile(false));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));

    assert.equal(history.redo("terrain"), true);
    await route();
    const cut = cutHoles(EDGE_TILE.chunk.x, EDGE_TILE.chunk.z, { [EDGE_TILE.index]: false });
    await server.receive("A", networkCommand(cut, { clientId: "A", timestamp: Date.now() + 1000 }));
    await route();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("undoing a chunk's removal brings back its holes", async() => {
    const { history, document, server, route } = await historySetup();
    document.patchHoles([{ tile: EDGE_TILE, holes: holeTile(true) }]);
    await route();
    history.record("terrain", null, () => document.removeChunk(EDGE_TILE.chunk.x, EDGE_TILE.chunk.z));
    await route();

    assert.equal(history.undo("terrain"), true);
    await route();

    const { holes } = server.state.terrain.chunk(EDGE_TILE.chunk)!;
    assert.deepEqual(holes.tile(EDGE_TILE.x, EDGE_TILE.z), holeTile(true));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });
});
