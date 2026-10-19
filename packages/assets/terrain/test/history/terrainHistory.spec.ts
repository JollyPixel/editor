// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  ChunkCoord,
  type TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  terrainHistoryRegistration,
  terrainSnapshot,
  type EncodedTilePatch,
  type TerrainCommand
} from "#src/index.ts";
import { MAX_PATCH_TILES } from "#src/network/TerrainCommand.schema.ts";
import {
  EDGE_TILE,
  ORIGIN_TILE,
  peerSetup
} from "../helpers/peers.ts";
import {
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

function historySetup() {
  const peers = peerSetup();
  const history = new CommandHistory<"terrain">();
  history.register(terrainHistoryRegistration(peers.document, { scope: "terrain" }));
  const skipped: string[] = [];
  history.on("skipped", (_scope, step) => skipped.push(step.refused.reason));

  function stroke(...heights: number[]): void {
    const step = history.open("terrain", null);
    for (const height of heights) {
      peers.sculpt(height);
    }
    step.commit();
    peers.flush();
    peers.deliver();
  }

  return { ...peers, history, skipped, stroke };
}

function peerTile(
  tile: TileCoord,
  height: number
): EncodedTilePatch {
  return encodeTilePatch({ tile, heights: tileHeights(height) });
}

function edgeHeight(
  { document }: ReturnType<typeof peerSetup>
): number {
  return document.terrain.chunk(EDGE_TILE.chunk)!.tileHeights(EDGE_TILE.x, EDGE_TILE.z)[0];
}

describe("terrain history", () => {
  test("a stroke of several commits undoes and redoes as one step, on the server too", () => {
    const peers = historySetup();
    const { history, server, document, flush, deliver } = peers;
    peers.stroke(3, 5);

    assert.equal(history.state("terrain").undoCount, 1);
    assert.equal(history.undo("terrain"), true);
    flush();
    deliver();
    assert.equal(edgeHeight(peers), 8);
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));

    assert.equal(history.redo("terrain"), true);
    flush();
    deliver();
    assert.equal(edgeHeight(peers), 5);
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("undo is skipped once a peer changed one of the stroke's tiles, not another tile", () => {
    const peers = historySetup();
    const { history, server, deliver, skipped } = peers;
    peers.stroke(5);
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [peerTile(ORIGIN_TILE, 1)] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));
    deliver();
    assert.equal(history.state("terrain").undoCount, 1);
    assert.deepEqual(skipped, []);

    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [peerTile(EDGE_TILE, -2)] },
      { clientId: "A", timestamp: Date.now() + 2000 }
    ));
    deliver();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
    assert.equal(edgeHeight(peers), -2);
  });

  test("undoing a chunk's creation is skipped once a peer sculpted it", () => {
    const { history, document, server, flush, deliver, skipped } = historySetup();
    history.record("terrain", null, () => document.addChunk(2, 0));
    flush();
    deliver();
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [{ ...peerTile(EDGE_TILE, 4), x: 2 }] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));
    deliver();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("the room refuses an undo of a chunk's creation that raced a peer's sculpt", () => {
    const { history, document, server, flush, deliver } = historySetup();
    history.record("terrain", null, () => document.addChunk(2, 0));
    flush();
    deliver();
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [{ ...peerTile(EDGE_TILE, 4), x: 2 }] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));

    assert.equal(history.undo("terrain"), true);
    flush();
    deliver();

    assert.equal(server.state.has(new ChunkCoord(2, 0)), true);
    assert.deepEqual(terrainSnapshot(document.terrain), terrainSnapshot(server.state));
  });

  test("merging a long stroke's inverses keeps the first heights per tile and fits the commit size", () => {
    const { compact } = terrainHistoryRegistration(peerSetup().document, { scope: "terrain" });
    const tiles = Array.from({ length: MAX_PATCH_TILES + 10 }, (_, index) => {
      return { x: index, z: 0, tile: 0, heights: `late-${index}` };
    });
    const merged = compact!([
      { action: "heights-patched", tiles },
      { action: "heights-patched", tiles: [{ x: 3, z: 0, tile: 0, heights: "first-3" }] }
    ]);

    assert.ok(merged.every((command) => command.action === "heights-patched" &&
      command.tiles.length <= MAX_PATCH_TILES));
    const written = merged.flatMap(
      (command: TerrainCommand) => (command.action === "heights-patched" ? command.tiles : [])
    );
    assert.equal(written.length, MAX_PATCH_TILES + 10);
    assert.equal(written.find(({ x }) => x === 3)!.heights, "first-3");
  });
});
