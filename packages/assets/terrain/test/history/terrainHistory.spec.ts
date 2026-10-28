// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  ChunkCoord,
  DEFAULT_MATERIAL_TEXTURE_SIZE,
  type TerrainReader,
  type TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  GROUND_MATERIAL,
  terrainSnapshot,
  type TerrainCommand
} from "#src/index.ts";
import { terrainHistoryRegistration } from "#src/network/client.ts";
import { MAX_PATCH_TILES } from "#src/network/TerrainCommand.schema.ts";
import {
  historySetup,
  peerTile
} from "../helpers/history.ts";
import {
  EDGE_TILE,
  ORIGIN_TILE,
  addWideChunkBlock,
  edgePeerSetup,
  terrainPeers,
  WIDE_BLOCK_CENTRE
} from "../helpers/peers.ts";
import {
  networkCommand,
  tileHeights
} from "../helpers/terrain.ts";

function edgeHeight(
  { document }: ReturnType<typeof edgePeerSetup>
): number {
  return document.terrain.chunk(EDGE_TILE.chunk)!.tileHeights(EDGE_TILE.x, EDGE_TILE.z)[0];
}

function heightAt(
  terrain: TerrainReader,
  tile: TileCoord
): number | undefined {
  return terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z)[0];
}

describe("terrain history", () => {
  test("a stroke of several commits undoes and redoes as one step, on the server too", () => {
    const peers = historySetup();
    const { history, server, document, route } = peers;
    peers.stroke(3, 5);

    assert.equal(history.state("terrain").undoCount, 1);
    assert.equal(history.undo("terrain"), true);
    route();
    assert.equal(edgeHeight(peers), 8);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));

    assert.equal(history.redo("terrain"), true);
    route();
    assert.equal(edgeHeight(peers), 5);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("undo is skipped once a peer changed one of the stroke's tiles, not another tile", () => {
    const peers = historySetup();
    const { history, server, route, skipped } = peers;
    peers.stroke(5);
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [peerTile(ORIGIN_TILE, 1)] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));
    route();
    assert.equal(history.state("terrain").undoCount, 1);
    assert.deepEqual(skipped, []);

    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [peerTile(EDGE_TILE, -2)] },
      { clientId: "A", timestamp: Date.now() + 2000 }
    ));
    route();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
    assert.equal(edgeHeight(peers), -2);
  });

  test("undoing a chunk's creation is skipped once a peer sculpted it", () => {
    const { history, document, server, route, skipped } = historySetup();
    history.record("terrain", null, () => document.addChunk(2, 0));
    route();
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [{ ...peerTile(EDGE_TILE, 4), x: 2 }] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));
    route();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("the room refuses an undo of a chunk's creation that raced a peer's sculpt", () => {
    const { history, document, server, route } = historySetup();
    history.record("terrain", null, () => document.addChunk(2, 0));
    route();
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [{ ...peerTile(EDGE_TILE, 4), x: 2 }] },
      { clientId: "A", timestamp: Date.now() + 1000 }
    ));

    assert.equal(history.undo("terrain"), true);
    route();

    assert.equal(server.state.terrain.has(new ChunkCoord(2, 0)), true);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("a removed material comes back with its properties on undo, on the server too", () => {
    const { history, document, server, route } = historySetup();
    document.updateMaterial(GROUND_MATERIAL.id, { tiling: 8, albedo: { id: "grass", kind: "texture" } });
    route();
    const before = document.materials.material(GROUND_MATERIAL.id);
    history.record("terrain", null, () => document.removeMaterial(GROUND_MATERIAL.id));
    route();

    assert.equal(history.undo("terrain"), true);
    route();

    assert.deepEqual(document.materials.material(GROUND_MATERIAL.id), before);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("a material edit undoes only its own fields, and is skipped once a peer changed one of them", () => {
    const { history, document, server, route, skipped } = historySetup();
    history.record("terrain", null, () => document.updateMaterial(GROUND_MATERIAL.id, { tiling: 8 }));
    route();
    server.receive("A", networkCommand(
      { action: "material-updated", id: GROUND_MATERIAL.id, changes: { name: "Grass" } },
      { clientId: "A" }
    ));
    route();

    assert.equal(history.undo("terrain"), true);
    route();
    assert.deepEqual(document.materials.material(GROUND_MATERIAL.id), { ...GROUND_MATERIAL, name: "Grass" });

    history.record("terrain", null, () => document.updateMaterial(GROUND_MATERIAL.id, { tiling: 8 }));
    route();
    server.receive("A", networkCommand(
      { action: "material-updated", id: GROUND_MATERIAL.id, changes: { tiling: 2 } },
      { clientId: "A" }
    ));
    route();

    assert.equal(history.undo("terrain"), false);
    assert.deepEqual(skipped, ["peer"]);
  });

  test("a texture size change undoes to the previous size", () => {
    const { history, document, server, route } = historySetup();
    history.record("terrain", null, () => document.changeTextureSize(2048));
    route();

    assert.equal(history.undo("terrain"), true);
    route();

    assert.equal(document.materials.textureSize, DEFAULT_MATERIAL_TEXTURE_SIZE);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("merging a long stroke's inverses keeps the first heights per tile and fits the commit size", () => {
    const { compact } = terrainHistoryRegistration(edgePeerSetup().document, { scope: "terrain" });
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

  test("an undo racing a peer's sculpt is refused whole and corrected without a snapshot", () => {
    const peers = historySetup();
    const { history, server, document, route } = peers;
    let resets = 0;
    document.on("reset", () => resets++);
    const step = history.open("terrain", null);
    document.patchTiles([EDGE_TILE, ORIGIN_TILE].map((tile) => {
      return { tile, heights: tileHeights(5) };
    }));
    step.commit();
    route();

    assert.equal(history.undo("terrain"), true);
    server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [peerTile(EDGE_TILE, -2)] },
      { clientId: "A" }
    ));
    route();

    assert.equal(edgeHeight(peers), -2);
    assert.equal(heightAt(document.terrain, ORIGIN_TILE), 5);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
    assert.equal(resets, 0);
  });

  test("a stroke over one command's tile limit reaches the room in several and undoes as one step", (t) => {
    const { server, join, route, dispose } = terrainPeers();
    t.after(dispose);
    const tiles = addWideChunkBlock(server);
    const { document, room } = join("B", { streamCentre: WIDE_BLOCK_CENTRE });
    const history = new CommandHistory<"terrain">();
    history.register(terrainHistoryRegistration(document, { scope: "terrain" }));

    const step = history.open("terrain", null);
    assert.equal(document.patchTiles(tiles.map((tile) => {
      return { tile, heights: tileHeights(4) };
    })), true);
    step.commit();
    assert.ok(room.sent.every((sent) => sent.action !== "heights-patched" ||
      sent.tiles.length <= MAX_PATCH_TILES));
    route();
    assert.ok(tiles.every((tile) => heightAt(server.state.terrain, tile) === 4));

    assert.equal(history.state("terrain").undoCount, 1);
    assert.equal(history.undo("terrain"), true);
    route();
    assert.ok(tiles.every((tile) => heightAt(server.state.terrain, tile) === 0));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });
});
