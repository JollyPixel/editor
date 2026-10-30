// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  SPLAT_CHANNELS,
  SPLAT_TEXELS
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  readSplatMasks,
  type SplatMask
} from "#src/network/client.ts";
import { stripPeers } from "../helpers/exchange.ts";

// CONSTANTS
const kFar = new ChunkCoord(12, 0);

function mask(
  slot: number,
  weight: number
): SplatMask {
  const samples = new Uint16Array(SPLAT_TEXELS ** 2).fill(weight);

  return { slot, image: { width: SPLAT_TEXELS, height: SPLAT_TEXELS, depth: 8, samples } };
}

describe("terrain splat import", () => {
  test("keeps the four strongest materials, and undoes and redoes on an unloaded chunk", async(t) => {
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

    assert.equal(history.redo("terrain"), true);
    route();
    assert.equal(server.state.terrain.chunk(kFar)!.splat.dominantSlot(0, 0), 2);
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
