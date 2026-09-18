// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../../src/world/index.ts";
import { packVoxel } from "../../../src/world/packedVoxel.ts";
import {
  LayerChunkCache
} from "../../../src/mesh/neighbourhood/LayerChunkCache.ts";

// CONSTANTS
const kChunkSize = 4;
const kSpan = kChunkSize + 2;

function makeWorld(
  position = { x: 0, y: 0, z: 0 }
): VoxelWorld {
  const world = new VoxelWorld(kChunkSize);
  const layer = world.addLayer("terrain");
  layer.position = position;

  for (let x = -3; x < 9; x++) {
    for (let y = -3; y < 9; y++) {
      for (let z = -3; z < 9; z++) {
        if ((x * 7 + y * 3 + z * 5) % 4 === 0) {
          world.setPackedVoxelAt(
            "terrain",
            { x, y, z },
            packVoxel(1 + ((x + y + z) & 3), 0)
          );
        }
      }
    }
  }

  return world;
}

function makeCache(
  world: VoxelWorld,
  window: Int32Array | null
): LayerChunkCache {
  return new LayerChunkCache({
    layer: world.getLayers()[0],
    chunkSize: kChunkSize,
    minWx: -1,
    minWy: -1,
    minWz: -1,
    window
  });
}

function assertSameLookups(
  world: VoxelWorld,
  window: Int32Array
): void {
  const direct = makeCache(world, null);
  const windowed = makeCache(world, window);

  for (let pass = 0; pass < 2; pass++) {
    for (let x = -3; x < 8; x++) {
      for (let y = -3; y < 8; y++) {
        for (let z = -3; z < 8; z++) {
          assert.equal(
            windowed.packedAt(x, y, z),
            direct.packedAt(x, y, z),
            `(${x}, ${y}, ${z})`
          );
        }
      }
    }
  }
}

describe("LayerChunkCache", () => {
  it("answers through the window exactly like direct chunk lookups", () => {
    assertSameLookups(makeWorld(), new Int32Array(kSpan ** 3));
  });

  it("stays exact for a layer whose chunks are not aligned on the window", () => {
    assertSameLookups(
      makeWorld({ x: 1, y: -2, z: 3 }),
      new Int32Array(kSpan ** 3)
    );
  });

  it("discards what a previous pass left in a reused window", () => {
    const window = new Int32Array(kSpan ** 3).fill(packVoxel(9, 0));

    assertSameLookups(makeWorld(), window);
  });

  it("rejects a window smaller than the padded chunk", () => {
    const cache = makeCache(makeWorld(), new Int32Array(8));

    assert.throws(
      () => cache.packedAt(0, 0, 0),
      RangeError
    );
  });
});
