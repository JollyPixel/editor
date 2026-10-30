// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import {
  resampleHeights,
  resampleHoles
} from "#src/terrain/chunkResample.ts";
import {
  chunkResolution,
  chunkSampleCount
} from "#src/terrain/chunkTier.ts";
import { HoleMask } from "#src/terrain/HoleMask.ts";
import { CHUNK_SAMPLE_COUNT } from "#src/terrain/TerrainChunk.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import { surfaceHeight } from "#src/terrain/terrainSurface.ts";
import {
  TILE_SAMPLE_COUNT,
  TileCoord
} from "#src/terrain/TileCoord.ts";

// CONSTANTS
const kChunk = new ChunkCoord(0, 0);
const kTolerance = 1e-4;

function bumpyTerrain(): Terrain {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      heights[localZ * CHUNK_SAMPLES + localX] = 9 * Math.sin(localX * 1.7) * Math.cos(localZ * 1.3);
    }
  }
  const terrain = new Terrain();
  terrain.addChunk(kChunk, heights);

  return terrain;
}

function holeBits(
  quads: number,
  holes: readonly (readonly [number, number])[]
): Uint8Array {
  const bits = new Uint8Array(quads * quads / 8);
  for (const [x, z] of holes) {
    const index = z * quads + x;
    bits[index >> 3] |= 1 << (index & 7);
  }

  return bits;
}

describe("resampleHeights", () => {
  test("refining x2 to x4 keeps the surface along an edge shared with a x2 neighbour", () => {
    const terrain = new Terrain();
    terrain.addChunk(kChunk, new Float32Array(chunkSampleCount(2)));
    const neighbour = new Float32Array(chunkSampleCount(2));
    neighbour[chunkResolution(2)] = 8;
    terrain.addChunk(new ChunkCoord(1, 0), neighbour);
    const expected = surfaceHeight(terrain, 63.75, 0.5);

    const heights = resampleHeights(terrain, kChunk, 4);

    assert.equal(expected, 4);
    assert.equal(heights[2 * chunkResolution(4) + chunkResolution(4) - 1], expected);
  });

  test("refining keeps the drawn surface in place, at x2 and x4", () => {
    const terrain = bumpyTerrain();
    for (const tier of [2, 4] as const) {
      const heights = resampleHeights(terrain, kChunk, tier);
      const resolution = CHUNK_SAMPLES * tier;
      for (let gridZ = 0; gridZ < resolution - tier; gridZ++) {
        for (let gridX = 0; gridX < resolution - tier; gridX++) {
          const expected = surfaceHeight(terrain, gridX / tier, gridZ / tier)!;
          assert.ok(
            Math.abs(heights[gridZ * resolution + gridX] - expected) < kTolerance,
            `x${tier} sample ${gridX},${gridZ}`
          );
        }
      }
    }
  });

  test("coarsening a refined chunk gives back its original heights exactly", () => {
    const terrain = bumpyTerrain();
    const original = terrain.chunk(kChunk)!.copyHeights();
    terrain.changeTier(kChunk, resampleHeights(terrain, kChunk, 4));

    assert.deepEqual(resampleHeights(terrain, kChunk, 1), original);
  });
});

describe("resampleHoles", () => {
  test("refining splits each hole quad, coarsening keeps any opening", () => {
    const holes = new HoleMask(holeBits(CHUNK_SAMPLES, [[3, 5]]));
    const refined = new HoleMask(resampleHoles(holes, 2));
    const fine = new HoleMask(holeBits(CHUNK_SAMPLES * 4, [[13, 1]]));

    assert.deepEqual(
      [refined.isHole(6, 10), refined.isHole(7, 11), refined.isHole(8, 10), refined.isHole(5, 10)],
      [true, true, false, false]
    );
    assert.deepEqual(resampleHoles(fine, 1), holeBits(CHUNK_SAMPLES, [[3, 0]]));
  });
});

describe("Terrain tiers", () => {
  test("a tile written at x2 updates the overview point it holds, and refuses a x1 tile", () => {
    const terrain = bumpyTerrain();
    terrain.changeTier(kChunk, resampleHeights(terrain, kChunk, 2));
    const heights = new Float32Array(TILE_SAMPLE_COUNT).fill(7);
    terrain.writeTile(new TileCoord(kChunk, 4, 4, 2), heights);

    assert.equal(terrain.overview.samples(kChunk)![3], 7);
    assert.equal(terrain.sampleAt(32, 32), 7);
    assert.throws(() => terrain.writeTile(new TileCoord(kChunk, 1, 1), heights), /x1, its chunk at x2/);
  });
});
