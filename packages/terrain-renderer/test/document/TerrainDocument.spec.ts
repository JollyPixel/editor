// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { CHUNK_SAMPLES, ChunkCoord } from "#src/document/ChunkCoord.ts";
import { BORDER_SAMPLES } from "#src/document/SampleBlock.ts";
import {
  CHUNK_SAMPLE_COUNT,
  HEIGHT_RANGE
} from "#src/document/TerrainChunk.ts";
import { TerrainDocument } from "#src/document/TerrainDocument.ts";
import {
  TILE_SAMPLE_COUNT,
  TILE_SAMPLES,
  TileCoord
} from "#src/document/TileCoord.ts";
import {
  randomInteger,
  seededRandom,
  type Random
} from "../helpers/random.ts";

function rampHeights(): Float32Array {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
    for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
      heights[localZ * CHUNK_SAMPLES + localX] = localX + localZ * 50;
    }
  }

  return heights;
}

function noiseHeights(
  random: Random
): Float32Array {
  const heights = new Float32Array(CHUNK_SAMPLE_COUNT);
  heights.forEach((_, index) => {
    heights[index] = randomInteger(random, -700, 700) / 7;
  });

  return heights;
}

function samplesAround(
  document: TerrainDocument,
  coord: ChunkCoord,
  margin: number
): number[] {
  const origin = coord.originSample;
  const samples: number[] = [];
  for (let localZ = -margin; localZ < CHUNK_SAMPLES + margin; localZ++) {
    for (let localX = -margin; localX < CHUNK_SAMPLES + margin; localX++) {
      samples.push(document.sampleAt(origin.x + localX, origin.z + localZ));
    }
  }

  return samples;
}

function assertSeededAddKeepsShownHeights(
  document: TerrainDocument,
  coord: ChunkCoord
): void {
  const shown = new Map(
    [...document.chunks()].map(
      ({ coord: shownCoord }) => [shownCoord.key, samplesAround(document, shownCoord, BORDER_SAMPLES)]
    )
  );
  const own = samplesAround(document, coord, 0);
  document.addChunk(coord);

  assert.deepEqual(samplesAround(document, coord, 0), own, `chunk ${coord.key} keeps its sampled heights`);
  for (const [key, samples] of shown) {
    const [x, z] = key.split(",").map(Number);
    assert.deepEqual(
      samplesAround(document, new ChunkCoord(x, z), BORDER_SAMPLES),
      samples,
      `adding ${coord.key} keeps the border chunk ${key} shows`
    );
  }
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

  test("sampleAt beside a chunk repeats its outer sample, and is 0 farther out", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), rampHeights());

    assert.equal(document.sampleAt(CHUNK_SAMPLES + 1, 10), CHUNK_SAMPLES - 1 + 500);
    assert.equal(document.sampleAt(-1, -1), 0);
    assert.equal(document.sampleAt(500, 10), 0);
  });

  test("a chunk seeded far from the terrain still extends the nearest sample", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), rampHeights());
    const added = document.addChunk(new ChunkCoord(7, 0));

    assert.equal(added.height(0, 10), CHUNK_SAMPLES - 1 + 500);
  });

  test("a seeded corner between a left and a below neighbour takes the below one", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, -1), new Float32Array(CHUNK_SAMPLE_COUNT).fill(5));
    document.addChunk(new ChunkCoord(-1, 0), new Float32Array(CHUNK_SAMPLE_COUNT).fill(9));
    const added = document.addChunk(new ChunkCoord(0, 0));

    assert.equal(added.height(0, 0), 5);
    assert.equal(added.height(0, 2), 9);
  });

  test("a seeded chunk beside a corner keeps the border its neighbour shows", () => {
    const document = new TerrainDocument();
    document.addChunk(new ChunkCoord(0, 0), noiseHeights(seededRandom(3)));

    assertSeededAddKeepsShownHeights(document, new ChunkCoord(-1, 1));
  });

  test("seeded chunks added next to the terrain keep every height it shows", () => {
    const random = seededRandom(2024);
    for (let layout = 0; layout < 12; layout++) {
      const document = new TerrainDocument();
      document.addChunk(new ChunkCoord(1, 1), noiseHeights(random));
      for (let index = 0; index < 4; index++) {
        const coord = new ChunkCoord(randomInteger(random, 0, 3), randomInteger(random, 0, 3));
        if (!document.has(coord)) {
          document.addChunk(coord, noiseHeights(random));
        }
      }
      for (let index = 0; index < 3; index++) {
        const coord = new ChunkCoord(randomInteger(random, -1, 4), randomInteger(random, -1, 4));
        if (!document.has(coord) && document.sampleBlock(coord).heightRange !== null) {
          assertSeededAddKeepsShownHeights(document, coord);
        }
      }
    }
  });

  test("a seeded chunk keeps the heights sampled at its place before it was added", () => {
    const document = new TerrainDocument();
    const coord = new ChunkCoord(0, 0);
    document.addChunk(new ChunkCoord(0, -1), new Float32Array(CHUNK_SAMPLE_COUNT).fill(5));
    document.addChunk(new ChunkCoord(-1, 0), rampHeights());
    document.addChunk(new ChunkCoord(1, 1), new Float32Array(CHUNK_SAMPLE_COUNT).fill(-3));
    document.addChunk(new ChunkCoord(3, 0), new Float32Array(CHUNK_SAMPLE_COUNT).fill(40));
    const origin = coord.originSample;
    const displayed = new Float32Array(CHUNK_SAMPLE_COUNT);
    for (let localZ = 0; localZ < CHUNK_SAMPLES; localZ++) {
      for (let localX = 0; localX < CHUNK_SAMPLES; localX++) {
        displayed[localZ * CHUNK_SAMPLES + localX] = document.sampleAt(origin.x + localX, origin.z + localZ);
      }
    }

    assert.deepEqual(document.addChunk(coord).copyHeights(), displayed);
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

  test("writeTile replaces one tile's samples and returns the ones it held", () => {
    const document = new TerrainDocument();
    const chunk = document.addChunk(new ChunkCoord(0, 0), rampHeights());
    const tile = new TileCoord(chunk.coord, 2, 1);
    const previous = document.writeTile(tile, new Float32Array(TILE_SAMPLE_COUNT).fill(-7));

    assert.equal(previous[0], 2 * TILE_SAMPLES + TILE_SAMPLES * 50);
    assert.equal(previous[TILE_SAMPLE_COUNT - 1], 3 * TILE_SAMPLES - 1 + (2 * TILE_SAMPLES - 1) * 50);
    assert.equal(chunk.height(2 * TILE_SAMPLES, TILE_SAMPLES), -7);
    assert.equal(chunk.height(3 * TILE_SAMPLES - 1, 2 * TILE_SAMPLES - 1), -7);
    assert.equal(chunk.height(3 * TILE_SAMPLES, TILE_SAMPLES), 3 * TILE_SAMPLES + TILE_SAMPLES * 50);
    assert.equal(chunk.height(2 * TILE_SAMPLES, 2 * TILE_SAMPLES), 2 * TILE_SAMPLES + 2 * TILE_SAMPLES * 50);
    assert.deepEqual(chunk.tileHeights(2, 1), new Float32Array(TILE_SAMPLE_COUNT).fill(-7));
    assert.deepEqual(chunk.heightRange, { min: -7, max: CHUNK_SAMPLES - 1 + (CHUNK_SAMPLES - 1) * 50 });
  });

  test("writeTile refuses invalid heights and a missing chunk", () => {
    const document = new TerrainDocument();
    const chunk = document.addChunk(new ChunkCoord(0, 0));
    const heights = new Float32Array(TILE_SAMPLE_COUNT);
    heights[3] = Number.POSITIVE_INFINITY;

    assert.throws(() => document.writeTile(new TileCoord(chunk.coord, 0, 0), heights), RangeError);
    assert.equal(chunk.height(3, 0), 0);
    assert.throws(() => document.writeTile(
      new TileCoord(new ChunkCoord(1, 0), 0, 0),
      new Float32Array(TILE_SAMPLE_COUNT)
    ));
  });

  test("the tile containing a sample counts from the chunk's corner", () => {
    const tile = TileCoord.containing(-1, CHUNK_SAMPLES + TILE_SAMPLES);

    assert.deepEqual([tile.chunk.key, tile.x, tile.z, tile.key], ["-1,1", 3, 1, "-1,1:7"]);
    assert.deepEqual(TileCoord.fromIndex(tile.chunk, tile.index), tile);
  });
});
