// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  GROUND_MATERIAL,
  terrainSnapshot
} from "#src/index.ts";
import {
  MAX_TERRAIN_MATERIALS,
  TerrainPreview
} from "#src/network/client.ts";
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
  test("a client starts from the room snapshot", async() => {
    const { server, document } = await edgePeerSetup();

    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("a chunk added by a client lands on the server with its seeded edge", async() => {
    const { server, document, route } = await edgePeerSetup();

    assert.equal(document.addChunk(2, 0), true);
    await route();

    const added = server.state.terrain.chunk(new ChunkCoord(2, 0));
    assert.ok(added?.copyHeights().every((height) => height === 8));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("a chunk added next to one a peer removed meanwhile is dropped everywhere", async() => {
    const { server, document, route } = await edgePeerSetup();

    document.addChunk(2, 0);
    await server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
    await route();

    assert.equal(document.terrain.has(new ChunkCoord(2, 0)), false);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test("two clients adding the same chunk settle on the first one admitted", async() => {
    const { server, document, route } = await edgePeerSetup();

    document.addChunk(1, 1);
    await server.receive("A", networkCommand(
      { action: "chunk-added", x: 1, z: 1, heights: heights(-3) },
      { clientId: "A" }
    ));
    await route();

    assert.ok(document.terrain.chunk(new ChunkCoord(1, 1))?.copyHeights().every((height) => height === -3));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test(
    "materials a client adds take the lowest free slots and land on the server, up to the cap",
    async() => {
      const { server, document, route } = await edgePeerSetup();
      document.removeMaterial(GROUND_MATERIAL.id);
      document.addMaterial({ name: "Rock" });

      const added = Array.from({ length: MAX_TERRAIN_MATERIALS }, () => document.addMaterial());
      await route();

      const slots = Array.from({ length: MAX_TERRAIN_MATERIALS }, (_, slot) => slot);
      assert.deepEqual(document.materials.materials().map(({ slot }) => slot), slots);
      assert.equal(document.materials.materials()[0].name, "Rock");
      assert.equal(added.at(-1), null);
      assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
    }
  );

  test(
    "peers editing different material fields both land, and a removal wins over a concurrent edit",
    async() => {
      const { server, document, route } = await edgePeerSetup();

      document.updateMaterial(GROUND_MATERIAL.id, { name: "Grass" });
      await server.receive("A", networkCommand(
        { action: "material-updated", id: GROUND_MATERIAL.id, changes: { tiling: 8 } },
        { clientId: "A" }
      ));
      await route();

      assert.deepEqual(
        document.materials.material(GROUND_MATERIAL.id),
        { ...GROUND_MATERIAL, name: "Grass", tiling: 8 }
      );
      assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));

      document.updateMaterial(GROUND_MATERIAL.id, { tiling: 2 });
      await server.receive("A", networkCommand(
        { action: "material-removed", id: GROUND_MATERIAL.id },
        { clientId: "A" }
      ));
      await route();

      assert.equal(document.materials.size, 0);
      assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
    }
  );

  test("a stroke reaches the server as one patch of its final heights", async() => {
    const { server, room, document, route } = await edgePeerSetup();
    const stroke = new TerrainPreview(document).beginStroke();
    stroke.write([{ tile: EDGE_TILE, heights: tileHeights(2) }]);
    stroke.write([{ tile: EDGE_TILE, heights: tileHeights(5) }]);

    assert.equal(stroke.commit(), true);
    assert.deepEqual(room.sent.map(({ action }) => action), ["heights-patched"]);
    await route();

    assert.deepEqual(server.state.terrain.chunk(EDGE_TILE.chunk)!.tileHeights(0, 2), tileHeights(5));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });

  test(
    "a stroke across a chunk a peer removed meanwhile keeps its other tiles, without a snapshot",
    async() => {
      const { server, document, sculpt, route } = await edgePeerSetup();
      let resets = 0;
      document.on("reset", () => resets++);
      sculpt(5, [EDGE_TILE, ORIGIN_TILE]);
      await server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
      await route();

      assert.equal(document.terrain.has(EDGE_TILE.chunk), false);
      assert.deepEqual(document.terrain.chunk(ORIGIN_TILE.chunk)!.tileHeights(3, 2), tileHeights(5));
      assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
      assert.equal(resets, 0);
    }
  );

  test("a stroke wholly on a chunk a peer removed meanwhile settles without a snapshot", async() => {
    const { server, document, sculpt, route } = await edgePeerSetup();
    let resets = 0;
    document.on("reset", () => resets++);
    sculpt(5);
    await server.receive("A", networkCommand({ action: "chunk-removed", x: 1, z: 0 }, { clientId: "A" }));
    await route();

    assert.equal(document.terrain.knows(EDGE_TILE.chunk), false);
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
    assert.equal(resets, 0);
  });

  test("two strokes on the same tile settle on the last one admitted", async() => {
    const { server, document, sculpt, route } = await edgePeerSetup();

    sculpt(5);
    await server.receive("A", networkCommand(
      { action: "heights-patched", tiles: [encodeTilePatch({ tile: EDGE_TILE, heights: tileHeights(-1) })] },
      { clientId: "A" }
    ));
    await route();

    assert.deepEqual(document.terrain.chunk(EDGE_TILE.chunk)!.tileHeights(0, 2), tileHeights(5));
    assert.deepEqual(terrainSnapshot(document), terrainSnapshot(server.state));
  });
});
