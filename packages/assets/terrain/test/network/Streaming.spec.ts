// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  ChunkCoord,
  TileCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  type TerrainCommand
} from "#src/index.ts";
import {
  terrainHistoryRegistration,
  type TerrainImage
} from "#src/network/client.ts";
import { terrainPeers } from "../helpers/peers.ts";
import {
  cutHoles,
  heights,
  networkCommand,
  paint,
  tileHeights
} from "../helpers/terrain.ts";

// CONSTANTS
const kStripLength = 13;
const kOverviewTile = 0;
const kInnerTile = 5;

async function stripPeers(
  t: TestContext
) {
  const peers = terrainPeers();
  t.after(peers.dispose);
  for (let x = 1; x < kStripLength; x++) {
    await peers.server.receive("X", networkCommand(
      { action: "chunk-added", x, z: 0, heights: heights(x) },
      { clientId: "X" }
    ));
  }

  return peers;
}

function chunkAt(
  x: number
): ChunkCoord {
  return new ChunkCoord(x, 0);
}

function loaded(
  terrain: TerrainReader
): number[] {
  return Array.from(terrain.chunks(), ({ coord }) => coord.x).sort((left, right) => left - right);
}

function heightAt(
  terrain: TerrainReader,
  tile: TileCoord
): number | undefined {
  return terrain.chunk(tile.chunk)?.tileHeights(tile.x, tile.z)[0];
}

function sculpt(
  x: number,
  tiles: Record<number, number>
): TerrainCommand {
  return {
    action: "heights-patched",
    tiles: Object.entries(tiles).map(([index, height]) => encodeTilePatch({
      tile: TileCoord.fromIndex(chunkAt(x), Number(index)),
      heights: tileHeights(height)
    }))
  };
}

describe("terrain streaming", () => {
  test(
    "following the camera loads the chunks within the radius and unloads those past one more",
    async(t) => {
      const { join, route } = await stripPeers(t);
      const { document, room } = await join("A");

      assert.deepEqual(loaded(document.terrain), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
      assert.equal(document.terrain.overview.size, kStripLength);

      document.stream.follow(chunkAt(10));
      assert.deepEqual(room.sent.at(-1), {
        action: "subscribe-parts",
        parts: [
          "10_0", "10_0_splat", "10_0_holes",
          "9_0", "9_0_splat", "9_0_holes",
          "11_0", "11_0_splat", "11_0_holes",
          "12_0", "12_0_splat", "12_0_holes"
        ]
      });
      assert.deepEqual(
        room.sent.at(-2),
        { action: "unsubscribe-parts", parts: ["0_0", "0_0_splat", "0_0_holes"] }
      );
      await route();

      assert.deepEqual(loaded(document.terrain), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      assert.equal(document.terrain.chunk(chunkAt(12))!.height(0, 0), 12);
      assert.equal(document.terrain.knows(chunkAt(0)), true);
    }
  );

  test(
    "a far peer's overview follows edits on unloaded chunks, and loading one brings its heights",
    async(t) => {
      const { server, join, route } = await stripPeers(t);
      const far = await join("B", { streamCentre: chunkAt(12) });
      const received: TerrainCommand[] = [];
      far.document.on("change", ({ command }) => received.push(command));

      const both = sculpt(1, { [kOverviewTile]: 5, [kInnerTile]: 6 });
      await server.receive("X", networkCommand(both, { clientId: "X" }));
      await server.receive("X", networkCommand(sculpt(1, { [kInnerTile]: 7 }), { clientId: "X" }));
      await route();

      assert.equal(far.document.terrain.has(chunkAt(1)), false);
      assert.equal(far.document.terrain.overview.samples(chunkAt(1))![0], 5);
      const tileCounts = received.map((command) => "tiles" in command && command.tiles.length);
      assert.deepEqual(tileCounts, [1]);

      far.document.stream.follow(chunkAt(1));
      await route();
      assert.equal(heightAt(far.document.terrain, TileCoord.fromIndex(chunkAt(1), kInnerTile)), 7);
    }
  );

  test(
    "a far peer's horizon takes painted overview points, and loading the chunk brings the paint",
    async(t) => {
      const { server, join, route } = await stripPeers(t);
      const far = await join("B", { streamCentre: chunkAt(12) });
      const received: TerrainCommand[] = [];
      far.document.on("change", ({ command }) => received.push(command));

      const painted = paint(1, 0, { [kOverviewTile]: 6, [kInnerTile]: 9 });
      await server.receive("X", networkCommand(painted, { clientId: "X" }));
      await route();

      assert.deepEqual([...far.document.terrain.overview.materials(chunkAt(1))!], [6, 0, 0, 0]);
      assert.deepEqual(received.map((command) => "tiles" in command && command.tiles.length), [1]);
      assert.deepEqual([...far.preview.terrain.overview.materials(chunkAt(1))!], [6, 0, 0, 0]);

      far.document.stream.follow(chunkAt(1));
      await route();
      const { splat } = far.preview.terrain.chunk(chunkAt(1))!;
      assert.deepEqual([splat.dominantSlot(0, 0), splat.dominantSlot(32, 32)], [6, 9]);
    }
  );

  test("a far peer receives nothing of a hole cut, and loading the chunk brings its holes", async(t) => {
    const { server, join, route } = await stripPeers(t);
    const far = await join("B", { streamCentre: chunkAt(12) });
    const received: TerrainCommand[] = [];
    far.document.on("change", ({ command }) => received.push(command));

    await server.receive("X", networkCommand(cutHoles(1, 0, { [kOverviewTile]: true }), { clientId: "X" }));
    await route();
    assert.deepEqual(received, []);

    far.document.stream.follow(chunkAt(1));
    await route();
    const { holes } = far.preview.terrain.chunk(chunkAt(1))!;
    assert.deepEqual([holes.isHole(0, 0), holes.isHole(16, 0)], [true, false]);
  });

  test(
    "the preview shows an unloaded chunk as its overview and reports each change to the view",
    async(t) => {
      const { server, join, route } = await stripPeers(t);
      const { document, preview } = await join("A");
      const events: string[] = [];
      preview.on("chunkAdded", (coord) => events.push(`added ${coord.key}`));
      preview.on("chunkRemoved", (coord) => events.push(`removed ${coord.key}`));
      preview.on("overviewChanged", (coords) => events.push(
        `overview ${coords.map(({ key }) => key).join()}`
      ));

      document.stream.follow(chunkAt(10));
      await route();
      assert.equal(preview.terrain.has(chunkAt(0)), false);
      assert.equal(preview.terrain.knows(chunkAt(0)), true);

      await server.receive("X", networkCommand(sculpt(0, { [kOverviewTile]: 5 }), { clientId: "X" }));
      await route();
      assert.equal(preview.terrain.overview.samples(chunkAt(0))![0], 5);

      document.stream.follow(chunkAt(0));
      await route();
      assert.equal(heightAt(preview.terrain, TileCoord.fromIndex(chunkAt(0), kOverviewTile)), 5);
      const origin = events.filter((event) => event.endsWith(" 0,0"));
      assert.deepEqual(origin, ["removed 0,0", "overview 0,0", "added 0,0"]);
    }
  );

  test("a chunk a peer adds loads where the stream reaches and stays an overview elsewhere", async(t) => {
    const { server, join, route } = await stripPeers(t);
    const near = await join("A");
    const far = await join("B", { streamCentre: chunkAt(12) });
    const added = new ChunkCoord(0, 1);

    near.document.addChunk(added.x, added.z);
    await route();
    assert.equal(far.document.terrain.has(added), false);
    assert.equal(far.document.terrain.knows(added), true);

    await server.receive("X", networkCommand(
      {
        action: "heights-patched",
        tiles: [encodeTilePatch({ tile: TileCoord.fromIndex(added, kInnerTile), heights: tileHeights(3) })]
      },
      { clientId: "X" }
    ));
    await route();
    assert.equal(heightAt(near.document.terrain, TileCoord.fromIndex(added, kInnerTile)), 3);
  });

  test(
    "undo skips a stroke on an unloaded chunk, and keeps one whose chunk loaded again unchanged",
    async(t) => {
      const { server, join, route } = await stripPeers(t);
      const { document } = await join("A");
      const history = new CommandHistory<"terrain">();
      history.register(terrainHistoryRegistration(document, { scope: "terrain" }));
      const tile = TileCoord.fromIndex(chunkAt(2), kInnerTile);
      async function stroke(height: number): Promise<void> {
        const step = history.open("terrain", null);
        document.patchTiles([{ tile, heights: tileHeights(height) }]);
        step.commit();
        await route();
      }
      async function followTo(x: number): Promise<void> {
        document.stream.follow(chunkAt(x));
        await route();
      }

      await stroke(9);
      await followTo(12);
      await followTo(0);
      assert.equal(history.undo("terrain"), true);
      await route();
      assert.equal(heightAt(server.state.terrain, tile), 2);

      await stroke(4);
      await followTo(12);
      assert.equal(history.undo("terrain"), false);
      assert.equal(heightAt(server.state.terrain, tile), 4);
    }
  );

  test("a rewind keeps each chunk loaded or unloaded as it is now", async(t) => {
    const { server, join, route } = await stripPeers(t);
    const { document } = await join("A");
    const images: TerrainImage[] = [];
    document.on("change", ({ image }) => images.push(image));
    const original = document.terrain.overview.samples(chunkAt(8));

    await server.receive("X", networkCommand(sculpt(10, { [kOverviewTile]: 5 }), { clientId: "X" }));
    await route();
    document.patchTiles([{ tile: TileCoord.fromIndex(chunkAt(8), kOverviewTile), heights: tileHeights(9) }]);
    document.stream.follow(chunkAt(18));
    await route();
    document.revert(images);

    assert.equal(heightAt(document.terrain, TileCoord.fromIndex(chunkAt(10), kOverviewTile)), 5);
    assert.equal(document.terrain.has(chunkAt(8)), false);
    assert.deepEqual(document.terrain.overview.samples(chunkAt(8)), original);
  });
});
