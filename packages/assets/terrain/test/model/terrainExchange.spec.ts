// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  chunkResolution,
  ChunkCoord,
  HOLE_BYTES,
  SPLAT_CHANNELS,
  SPLAT_TEXELS,
  type ChunkRect,
  type ChunkTier
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { encodeHoles } from "#src/index.ts";
import {
  chunksInRect,
  readHeightGrid,
  readSplatMasks,
  terrainHistoryRegistration,
  type ChunkContents,
  type SplatMask
} from "#src/network/client.ts";
import { terrainPeers } from "../helpers/peers.ts";
import {
  heights,
  networkCommand
} from "../helpers/terrain.ts";

// CONSTANTS
const kFar = new ChunkCoord(12, 0);
const kStrip = 13;

function stripPeers(
  t: TestContext
) {
  const peers = terrainPeers();
  t.after(peers.dispose);
  for (let x = 1; x < kStrip; x++) {
    peers.server.receive("X", networkCommand(
      { action: "chunk-added", x, z: 0, heights: heights(x) },
      { clientId: "X" }
    ));
  }
  const peer = peers.join("A");
  const history = new CommandHistory<"terrain">();
  history.register(terrainHistoryRegistration(peer.document, { scope: "terrain" }));

  async function read(
    rect: ChunkRect
  ): Promise<ChunkContents[]> {
    const coords = chunksInRect(rect);
    const collected: ChunkContents[] = [];
    const reading = (async() => {
      for await (const chunk of peer.document.stream.read(coords)) {
        collected.push(chunk);
      }
    })();
    await setImmediate();
    peers.route();
    await reading;

    return collected;
  }

  return { ...peers, ...peer, history, read };
}

function flatGrid(
  rect: ChunkRect,
  tier: ChunkTier,
  height: number
): Float32Array {
  return new Float32Array(rect.columns * rect.rows * chunkResolution(tier) ** 2).fill(height);
}

function mask(
  slot: number,
  weight: number
): SplatMask {
  const samples = new Uint16Array(SPLAT_TEXELS ** 2).fill(weight);

  return { slot, image: { width: SPLAT_TEXELS, height: SPLAT_TEXELS, depth: 8, samples } };
}

describe("terrain heightmap import", () => {
  test("covers loaded, unloaded and new chunks, updates the overview, and undoes as one step", async(t) => {
    const { server, route, document, history, read } = stripPeers(t);
    const rect = { x: 11, z: 0, columns: 3, rows: 1 };
    const created = new ChunkCoord(13, 0);
    const overviewBefore = document.terrain.overview.samples(kFar)![0];

    const before = await read(rect);
    assert.equal(before.length, 2);
    const grid = flatGrid(rect, 1, 50);
    assert.equal(history.record("terrain", null, () => document.importHeights(rect, 1, grid, before)), true);
    route();

    for (const coord of chunksInRect(rect)) {
      assert.equal(server.state.terrain.chunk(coord)?.height(3, 3), 50);
    }
    assert.equal(document.terrain.overview.samples(kFar)![0], 50);
    assert.equal(document.terrain.has(kFar), false);

    assert.equal(history.undo("terrain"), true);
    route();

    assert.equal(server.state.terrain.chunk(kFar)?.height(3, 3), kFar.x);
    assert.equal(server.state.terrain.chunk(new ChunkCoord(11, 0))?.height(3, 3), 11);
    assert.equal(server.state.terrain.knows(created), false);
    assert.equal(document.terrain.overview.samples(kFar)![0], overviewBefore);
    assert.equal(history.state("terrain").canUndo, false);
  });

  test("moves an unloaded chunk to the chosen tier, and undo brings back its heights and holes", async(t) => {
    const { server, route, document, history, read } = stripPeers(t);
    const holes = new Uint8Array(HOLE_BYTES);
    holes[0] = 1;
    server.receive("X", networkCommand(
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
    route();
    const rect = { x: kFar.x, z: 0, columns: 1, rows: 1 };

    const before = await read(rect);
    history.record("terrain", null, () => document.importHeights(rect, 2, flatGrid(rect, 2, 8), before));
    route();

    const refined = server.state.terrain.chunk(kFar)!;
    assert.equal(refined.tier, 2);
    assert.equal(refined.sample(100, 100), 8);
    assert.equal(refined.holes.isHole(0, 0), true);
    assert.equal(document.terrain.overview.samples(kFar)![0], 8);

    assert.equal(history.undo("terrain"), true);
    route();

    const restored = server.state.terrain.chunk(kFar)!;
    assert.equal(restored.tier, 1);
    assert.equal(restored.height(5, 5), kFar.x);
    assert.equal(restored.holes.isHole(0, 0), true);
    assert.equal(document.terrain.overview.samples(kFar)![0], kFar.x);
  });

  test("refuses a rectangle that cannot be placed", (t) => {
    const { document } = stripPeers(t);

    assert.equal(document.importRefusal({ x: 126, z: 0, columns: 4, rows: 1 }), "out-of-range");
    assert.equal(document.importRefusal({ x: 40, z: 40, columns: 2, rows: 2 }), "disconnected");
    assert.equal(document.importRefusal({ x: 0, z: 0, columns: 100, rows: 100 }), "too-many-chunks");
    assert.equal(document.importRefusal({ x: 0, z: 1, columns: 3, rows: 2 }), null);
  });

  test("a whole rectangle exported then imported keeps every height", async(t) => {
    const { server, route, document, history, read } = stripPeers(t);
    const rect = { x: 11, z: 0, columns: 2, rows: 1 };
    const before = await read(rect);

    async function* chunks() {
      yield* before;
    }
    const grid = (await readHeightGrid(chunks(), rect, 1))!;
    assert.deepEqual(grid.range, { min: 11, max: 12 });
    assert.equal(grid.width, 128);

    history.record("terrain", null, () => document.importHeights(rect, 1, grid.heights, before));
    route();

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

describe("terrain splat import", () => {
  test("keeps the four strongest materials, scaled to 255, and undoes on an unloaded chunk", async(t) => {
    const { server, route, document, history, read } = stripPeers(t);
    const rect = { x: kFar.x, z: 0, columns: 1, rows: 1 };
    const masks = [mask(1, 10), mask(2, 100), mask(3, 60), mask(4, 40), mask(5, 20)];

    const before = await read(rect);
    history.record("terrain", "Import splat", () => document.importSplat(rect, masks, before));
    route();

    const { indices, weights } = server.state.terrain.chunk(kFar)!.splat.copy();
    assert.deepEqual([...indices.subarray(0, SPLAT_CHANNELS)], [2, 3, 4, 5]);
    assert.equal(weights.subarray(0, SPLAT_CHANNELS).reduce((sum, weight) => sum + weight, 0), 255);
    assert.equal(document.terrain.overview.materials(kFar)![0], 2);

    assert.equal(history.undo("terrain"), true);
    route();
    assert.equal(server.state.terrain.chunk(kFar)!.splat.dominantSlot(0, 0), 0);
  });

  test("leaves a texel with no mask as it was", async(t) => {
    const { server, route, document, history, read } = stripPeers(t);
    const rect = { x: kFar.x, z: 0, columns: 1, rows: 1 };
    const masks = [mask(2, 0)];
    masks[0].image.samples[1] = 200;

    const before = await read(rect);
    history.record("terrain", null, () => document.importSplat(rect, masks, before));
    route();

    const { splat } = server.state.terrain.chunk(kFar)!;
    assert.equal(splat.dominantSlot(0, 0), 0);
    assert.equal(splat.dominantSlot(1, 0), 2);
  });

  test("exports one mask per painted material, with its weights", async(t) => {
    const { read } = stripPeers(t);
    const rect = { x: kFar.x, z: 0, columns: 1, rows: 1 };
    const before = await read(rect);

    async function* chunks() {
      yield* before;
    }
    const masks = await readSplatMasks(chunks(), rect);

    assert.deepEqual(masks.map(({ slot }) => slot), [0]);
    assert.equal(masks[0].image.samples[0], 255);
    assert.equal(masks[0].image.width, SPLAT_TEXELS);
  });
});
