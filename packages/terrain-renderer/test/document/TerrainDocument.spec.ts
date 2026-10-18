// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  CHUNK_SAMPLES,
  ChunkCoord,
  HEIGHT_RANGE,
  TerrainDocument
} from "#src/index.ts";

function rampHeights(): Float32Array {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      heights[localZ * CHUNK_SAMPLES + localX] = localX + localZ * 50;
    }
  }

  return heights;
}

describe("TerrainDocument", () => {
  test("a first chunk starts flat", () => {
    const document = new TerrainDocument();
    const chunk = document.addChunk(new ChunkCoord(0, 0));

    assert.ok(chunk.copyHeights().every((height) => height === 0));
  });

  test("a chunk added on +X extends its neighbour's last column", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), rampHeights());
    const added = document.addChunk(new ChunkCoord(1, 0));

    for (const localZ of [0, 17, CHUNK_SAMPLES - 1]) {
      for (const localX of [0, 40, CHUNK_SAMPLES - 1]) {
        assert.equal(added.height(localX, localZ), CHUNK_SAMPLES - 1 + localZ * 50);
      }
    }
  });

  test("a chunk added on -Z extends its neighbour's first row", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), rampHeights());
    const added = document.addChunk(new ChunkCoord(0, -1));

    assert.equal(added.height(5, 0), 5);
    assert.equal(added.height(5, CHUNK_SAMPLES - 1), 5);
  });

  test("sampleAt reads across chunk edges in world samples", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), rampHeights());
    document.addChunk(new ChunkCoord(-1, 0), rampHeights());

    assert.equal(document.sampleAt(-1, 3), CHUNK_SAMPLES - 1 + 150);
    assert.equal(document.sampleAt(0, 3), 150);
  });

  test("sampleAt over empty ground clamps to the nearest existing sample", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), rampHeights());

    assert.equal(document.sampleAt(500, 10), CHUNK_SAMPLES - 1 + 500);
    assert.equal(document.sampleAt(-500, -500), 0);
  });

  test("sampleAt on an empty terrain is 0", () => {
    assert.equal(new TerrainDocument().sampleAt(12, -40), 0);
  });

  test("a chunk can be added only once", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(2, 3));

    assert.throws(() => document.addChunk(new ChunkCoord(2, 3)));
  });

  test("heights outside the height range are refused", () => {
    const document = new TerrainDocument();
    const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
    heights[10] = HEIGHT_RANGE.max + 1;

    assert.throws(() => document.addChunk(new ChunkCoord(0, 0), heights), RangeError);
    heights[10] = Number.NaN;
    assert.throws(() => document.addChunk(new ChunkCoord(0, 0), heights), RangeError);
    assert.equal(document.size, 0);
  });

  test("a chunk keeps a copy of the heights it was given", () => {
    const document = new TerrainDocument();
    const heights = rampHeights();
    const chunk = document.addChunk(new ChunkCoord(0, 0), heights);
    heights[0] = 999;
    chunk.copyHeights()[1] = 999;

    assert.equal(chunk.height(0, 0), 0);
    assert.equal(chunk.height(1, 0), 1);
  });

  test("touches is true only for a 4-neighbour of an existing chunk", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0));

    assert.equal(document.touches(new ChunkCoord(0, 1)), true);
    assert.equal(document.touches(new ChunkCoord(1, 1)), false);
  });
});
