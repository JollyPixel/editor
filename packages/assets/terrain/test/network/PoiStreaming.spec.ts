// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  MAX_CHUNK_LAYERS,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { terrainPeers } from "../helpers/peers.ts";
import {
  heights,
  networkCommand
} from "../helpers/terrain.ts";

// CONSTANTS
const kBlockWidth = 100;
const kBlockRows = 3;

async function blockPeers(
  t: TestContext,
  width: number,
  rows: number
) {
  const peers = terrainPeers();
  t.after(peers.dispose);
  for (let z = 0; z < rows; z++) {
    for (let x = z === 0 ? 1 : 0; x < width; x++) {
      await peers.server.receive("X", networkCommand(
        { action: "chunk-added", x, z, heights: heights(0) },
        { clientId: "X" }
      ));
    }
  }

  return peers;
}

function chunks(
  fromX: number,
  toX: number,
  rows = 1
): { x: number; z: number; }[] {
  return Array.from({ length: (toX - fromX + 1) * rows }, (_, index) => {
    return { x: fromX + index % (toX - fromX + 1), z: Math.floor(index / (toX - fromX + 1)) };
  });
}

function isLoaded(
  terrain: TerrainReader,
  x: number,
  z = 0
): boolean {
  return terrain.has(new ChunkCoord(x, z));
}

describe("point-of-interest streaming", () => {
  test("a point of interest keeps its chunks loaded at any distance until it lets them go", async(t) => {
    const { join, route } = await blockPeers(t, 30, 1);
    const { document } = await join("A");
    const id = document.addPointOfInterest({ chunks: [{ x: 25, z: 0 }, { x: 99, z: 0 }] })!;
    await route();

    assert.deepEqual([isLoaded(document.terrain, 25), isLoaded(document.terrain, 20)], [true, false]);
    document.stream.follow(new ChunkCoord(5, 0));
    await route();
    assert.equal(isLoaded(document.terrain, 25), true);

    document.updatePointOfInterest(id, { chunks: [] });
    await route();
    assert.equal(isLoaded(document.terrain, 25), false);
  });

  test("past the free layers, higher priorities load first, then the nearest, within them", async(t) => {
    const { join, route } = await blockPeers(t, kBlockWidth, kBlockRows);
    const { document } = await join("A");
    const far = chunks(kBlockWidth - 5, kBlockWidth - 1, kBlockRows);
    document.addPointOfInterest({ priority: 0, chunks: chunks(20, kBlockWidth - 1, kBlockRows) });
    document.addPointOfInterest({ priority: 5, chunks: far });
    await route();

    assert.ok(far.every(({ x, z }) => isLoaded(document.terrain, x, z)));
    assert.deepEqual(
      [isLoaded(document.terrain, 20), isLoaded(document.terrain, kBlockWidth - 6, kBlockRows - 1)],
      [true, false]
    );
    assert.ok(document.terrain.size <= MAX_CHUNK_LAYERS);
  });
});
