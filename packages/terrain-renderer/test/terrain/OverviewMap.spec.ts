// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/terrain/ChunkCoord.ts";
import { CHUNK_SAMPLE_COUNT } from "#src/terrain/TerrainChunk.ts";
import { Terrain } from "#src/terrain/Terrain.ts";
import {
  TILE_SAMPLE_COUNT,
  TileCoord
} from "#src/terrain/TileCoord.ts";

// CONSTANTS
const kChunk = new ChunkCoord(1, 0);

function rampHeights(): Float32Array {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      heights[localZ * CHUNK_SAMPLES + localX] = localX + localZ * 50;
    }
  }

  return heights;
}

describe("OverviewMap", () => {
  test("holds each chunk's heights at the 32 m grid points", () => {
    const terrain = new Terrain();
    terrain.addChunk(kChunk, rampHeights());

    assert.deepEqual(terrain.overview.samples(kChunk), Float32Array.of(0, 32, 1600, 1632));
    assert.equal(terrain.overview.heightAt(CHUNK_SAMPLES + 32, 32), 1632);
    assert.equal(terrain.overview.heightAt(CHUNK_SAMPLES + 31, 32), undefined);
    assert.equal(terrain.overview.heightAt(0, 0), undefined);
  });

  test("follows the tile writes and the removal of its chunk", () => {
    const terrain = new Terrain();
    terrain.addChunk(kChunk, rampHeights());

    terrain.writeTile(new TileCoord(kChunk, 2, 0), new Float32Array(TILE_SAMPLE_COUNT).fill(7));
    assert.deepEqual(terrain.overview.samples(kChunk), Float32Array.of(0, 7, 1600, 1632));

    terrain.removeChunk(kChunk);
    assert.equal(terrain.overview.samples(kChunk), undefined);
    assert.equal(terrain.overview.size, 0);
  });

  test("an unloaded chunk stays known through its samples, and its overview tiles still write them", () => {
    const terrain = new Terrain();
    terrain.addChunk(kChunk, rampHeights());
    terrain.unloadChunk(kChunk);

    assert.equal(terrain.has(kChunk), false);
    assert.equal(terrain.knows(kChunk), true);
    const flat = new Float32Array(TILE_SAMPLE_COUNT).fill(7);
    assert.equal(terrain.writeOverviewTile(new TileCoord(kChunk, 1, 0), flat), false);
    assert.equal(terrain.writeOverviewTile(new TileCoord(kChunk, 2, 2), flat), true);
    assert.deepEqual(terrain.overview.samples(kChunk), Float32Array.of(0, 32, 1600, 7));

    terrain.loadChunk(kChunk, new Float32Array(CHUNK_SAMPLE_COUNT).fill(3));
    assert.deepEqual(terrain.overview.samples(kChunk), Float32Array.of(3, 3, 3, 3));
  });

  test("interpolates across chunks; a corner on unknown ground takes the height at the cell's origin", () => {
    const terrain = new Terrain();
    terrain.addUnloadedChunk(new ChunkCoord(0, 0), Float32Array.of(0, 10, 20, 30));
    terrain.addUnloadedChunk(new ChunkCoord(1, 0), Float32Array.of(50, 60, 70, 80));

    assert.equal(terrain.overview.interpolate(16, 16), 15);
    assert.equal(terrain.overview.interpolate(48, 0), 30);
    assert.equal(terrain.overview.interpolate(48, 48), 40);
    assert.equal(terrain.overview.interpolate(-1, 0), undefined);
  });
});
