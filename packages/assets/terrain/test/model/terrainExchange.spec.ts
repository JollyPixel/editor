// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  chunkResolution,
  ChunkCoord,
  chunkSampleCount,
  HOLE_BYTES,
  type ChunkRect,
  type ChunkTier
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeHeights,
  encodeHoles
} from "#src/index.ts";
import {
  chunksInRect,
  readHeightGrid
} from "#src/network/client.ts";
import { stripPeers } from "../helpers/exchange.ts";
import {
  heights,
  networkCommand
} from "../helpers/terrain.ts";

// CONSTANTS
const kFar = new ChunkCoord(12, 0);

function flatGrid(
  rect: ChunkRect,
  tier: ChunkTier,
  height: number
): Float32Array {
  return new Float32Array(rect.columns * rect.rows * chunkResolution(tier) ** 2).fill(height);
}

describe("terrain heightmap import", () => {
  test("covers loaded, unloaded and new chunks, updates the overview, and undoes as one step", async(t) => {
    const { server, route, document, history, read } = await stripPeers(t);
    const rect = { x: 11, z: 0, columns: 3, rows: 1 };
    const created = new ChunkCoord(13, 0);
    const overviewBefore = document.terrain.overview.samples(kFar)![0];

    const before = await read(rect);
    assert.equal(before.length, 2);
    const grid = flatGrid(rect, 1, 50);
    assert.equal(history.record("terrain", null, () => document.importHeights(rect, 1, grid, before)), true);
    await route();

    for (const coord of chunksInRect(rect)) {
      assert.equal(server.state.terrain.chunk(coord)?.height(3, 3), 50);
    }
    assert.equal(document.terrain.overview.samples(kFar)![0], 50);
    assert.equal(document.terrain.has(kFar), false);

    assert.equal(history.undo("terrain"), true);
    await route();

    assert.equal(server.state.terrain.chunk(kFar)?.height(3, 3), kFar.x);
    assert.equal(server.state.terrain.chunk(new ChunkCoord(11, 0))?.height(3, 3), 11);
    assert.equal(server.state.terrain.knows(created), false);
    assert.equal(document.terrain.overview.samples(kFar)![0], overviewBefore);
    assert.equal(history.state("terrain").canUndo, false);
  });

  test("moves an unloaded chunk to the chosen tier, and undo brings back its heights and holes", async(t) => {
    const { server, route, document, history, read } = await stripPeers(t);
    const holes = new Uint8Array(HOLE_BYTES);
    holes[0] = 1;
    await server.receive("X", networkCommand(
      {
        action: "tier-changed",
        x: kFar.x,
        z: 0,
        tier: 1,
        heights: heights(kFar.x),
        holes: encodeHoles(holes)
      },
      { clientId: "X" }
    ));
    await route();
    const rect = { x: kFar.x, z: 0, columns: 1, rows: 1 };

    const before = await read(rect);
    history.record("terrain", null, () => document.importHeights(rect, 2, flatGrid(rect, 2, 8), before));
    await route();

    const refined = server.state.terrain.chunk(kFar)!;
    assert.equal(refined.tier, 2);
    assert.equal(refined.sample(100, 100), 8);
    assert.equal(refined.holes.isHole(0, 0), true);
    assert.equal(document.terrain.overview.samples(kFar)![0], 8);

    assert.equal(history.undo("terrain"), true);
    await route();

    const restored = server.state.terrain.chunk(kFar)!;
    assert.equal(restored.tier, 1);
    assert.equal(restored.height(5, 5), kFar.x);
    assert.equal(restored.holes.isHole(0, 0), true);
    assert.equal(document.terrain.overview.samples(kFar)![0], kFar.x);
  });

  test("undoing a tier change on a loaded chunk restores the chunks imported beside it", async(t) => {
    const { server, route, document, history, read } = await stripPeers(t);
    const beside = new ChunkCoord(2, 0);
    const refined = encodeHeights(new Float32Array(chunkSampleCount(2)).fill(2));
    await server.receive("X", networkCommand(
      { action: "tier-changed", x: beside.x, z: 0, tier: 2, heights: refined },
      { clientId: "X" }
    ));
    await route();
    const rect = { x: 1, z: 0, columns: 2, rows: 1 };

    const before = await read(rect);
    history.record("terrain", null, () => document.importHeights(rect, 2, flatGrid(rect, 2, 50), before));
    await route();
    assert.equal(history.undo("terrain"), true);
    await route();

    assert.equal(server.state.terrain.chunk(new ChunkCoord(1, 0))?.tier, 1);
    assert.equal(server.state.terrain.chunk(beside)?.sample(100, 100), 2);
  });

  test("redo brings an import back on unloaded chunks and on a new one, and undoes again", async(t) => {
    const { server, route, document, history, read } = await stripPeers(t);
    const rect = { x: 11, z: 0, columns: 3, rows: 1 };
    const created = new ChunkCoord(13, 0);
    const before = await read(rect);
    history.record("terrain", null, () => document.importHeights(rect, 1, flatGrid(rect, 1, 50), before));
    await route();

    history.undo("terrain");
    await route();
    assert.equal(history.redo("terrain"), true);
    await route();
    assert.equal(server.state.terrain.chunk(kFar)?.height(3, 3), 50);
    assert.equal(server.state.terrain.chunk(created)?.height(3, 3), 50);

    assert.equal(history.undo("terrain"), true);
    await route();
    assert.equal(server.state.terrain.chunk(kFar)?.height(3, 3), kFar.x);
    assert.equal(server.state.terrain.knows(created), false);
  });

  test("an import whose chunks changed since they were read writes nothing", async(t) => {
    const { server, route, document, read } = await stripPeers(t);
    const rect = { x: 1, z: 0, columns: 2, rows: 1 };
    const before = await read(rect);
    await server.receive("X", networkCommand({ action: "chunk-removed", x: 2, z: 0 }, { clientId: "X" }));
    await route();

    assert.equal(document.importHeights(rect, 1, flatGrid(rect, 1, 50), before), false);
    await route();
    assert.equal(server.state.terrain.chunk(new ChunkCoord(1, 0))?.height(3, 3), 1);
  });

  test("refuses a rectangle that cannot be placed", async(t) => {
    const { document } = await stripPeers(t);

    assert.equal(document.importRefusal({ x: 126, z: 0, columns: 4, rows: 1 }), "out-of-range");
    assert.equal(document.importRefusal({ x: 40, z: 40, columns: 2, rows: 2 }), "disconnected");
    assert.equal(document.importRefusal({ x: 0, z: 0, columns: 100, rows: 100 }), "too-many-chunks");
    assert.equal(document.importRefusal({ x: 0, z: 1, columns: 3, rows: 2 }), null);
  });

  test("a whole rectangle exported then imported keeps every height", async(t) => {
    const { server, route, document, history, read } = await stripPeers(t);
    const rect = { x: 11, z: 0, columns: 2, rows: 1 };
    const before = await read(rect);

    async function* chunks() {
      yield* before;
    }
    const grid = (await readHeightGrid(chunks(), rect, 1))!;
    assert.deepEqual(grid.range, { min: 11, max: 12 });
    assert.equal(grid.width, 128);

    history.record("terrain", null, () => document.importHeights(rect, 1, grid.heights, before));
    await route();

    assert.equal(server.state.terrain.chunk(kFar)?.height(0, 0), 12);
    assert.equal(server.state.terrain.chunk(new ChunkCoord(11, 0))?.height(63, 63), 11);
  });

  test("a chunk the rectangle lacks exports at the lowest height", async() => {
    async function* chunks() {
      yield {
        coord: new ChunkCoord(0, 0),
        heights: new Float32Array(64 * 64).fill(5),
        splat: { indices: new Uint8Array(0), weights: new Uint8Array(0) },
        holes: undefined
      };
    }
    const grid = (await readHeightGrid(chunks(), { x: 0, z: 0, columns: 2, rows: 1 }, 1))!;

    assert.equal(grid.heights[64], 5);
  });
});

