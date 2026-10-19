// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  CHUNK_SAMPLES,
  ChunkCoord,
  HEIGHT_RANGE,
  TerrainDocument,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  sculptStamp,
  type SculptStamp
} from "#src/features/sculpt/model/sculptStamp.ts";

function flatTerrain(
  ...chunks: Array<[x: number, z: number, height: number]>
): TerrainDocument {
  const terrain = new TerrainDocument();
  for (const [x, z, height] of chunks) {
    terrain.addChunk(new ChunkCoord(x, z), new Float32Array(CHUNK_SAMPLE_COUNT).fill(height));
  }

  return terrain;
}

function stamp(
  terrain: TerrainDocument,
  options: Partial<SculptStamp> & Pick<SculptStamp, "tool" | "x" | "z">
): TerrainDocument {
  for (const { tile, heights } of sculptStamp(terrain, {
    radius: 4,
    strength: 1,
    falloff: "smooth",
    ...options
  })) {
    terrain.writeTile(tile, heights);
  }

  return terrain;
}

describe("sculptStamp", () => {
  test("raise lifts the centre fully, fades to the radius and returns only the tiles it changed", () => {
    const terrain = flatTerrain([0, 0, 0]);
    const patches: TilePatch[] = sculptStamp(terrain, {
      tool: "raise",
      x: 40,
      z: 40,
      radius: 4,
      strength: 0.5,
      falloff: "linear",
      lift: 2
    });
    for (const { tile, heights } of patches) {
      terrain.writeTile(tile, heights);
    }

    assert.deepEqual(patches.map(({ tile }) => tile.key), ["0,0:10"]);
    assert.equal(terrain.sampleAt(40, 40), 1);
    assert.equal(terrain.sampleAt(42, 40), 0.5);
    assert.equal(terrain.sampleAt(44, 40), 0);
    assert.equal(terrain.sampleAt(38, 38), Math.fround(1 - Math.hypot(2, 2) / 4));
  });

  test("a stamp across a chunk edge writes both chunks and drops the part over empty ground", () => {
    const terrain = flatTerrain([0, 0, 0], [1, 0, 0]);
    const patches = sculptStamp(terrain, {
      tool: "raise",
      x: CHUNK_SAMPLES,
      z: 0,
      radius: 6,
      strength: 1,
      falloff: "constant",
      lift: 3
    });

    assert.deepEqual(patches.map(({ tile }) => tile.key).sort(), ["0,0:3", "1,0:0"]);
    for (const { tile, heights } of patches) {
      terrain.writeTile(tile, heights);
    }
    assert.equal(terrain.sampleAt(CHUNK_SAMPLES - 6, 0), 3);
    assert.equal(terrain.sampleAt(CHUNK_SAMPLES + 6, 0), 3);
  });

  test("lowering stops at the height range", () => {
    const terrain = stamp(flatTerrain([0, 0, HEIGHT_RANGE.min + 1]), { tool: "raise", x: 8, z: 8, lift: -5 });

    assert.equal(terrain.sampleAt(8, 8), HEIGHT_RANGE.min);
  });

  test("flatten moves samples toward the target by their weight", () => {
    const terrain = stamp(flatTerrain([0, 0, 10]), {
      tool: "flatten",
      x: 20,
      z: 20,
      falloff: "linear",
      target: 2
    });

    assert.equal(terrain.sampleAt(20, 20), 2);
    assert.equal(terrain.sampleAt(22, 20), 6);
    assert.equal(terrain.sampleAt(24, 20), 10);
  });

  test("smooth pulls a spike toward its neighbours and leaves flat ground alone", () => {
    const terrain = flatTerrain([0, 0, 0]);
    const spike = new Float32Array(CHUNK_SAMPLE_COUNT);
    spike[20 * CHUNK_SAMPLES + 20] = 16;
    terrain.removeChunk(new ChunkCoord(0, 0));
    terrain.addChunk(new ChunkCoord(0, 0), spike);
    stamp(terrain, { tool: "smooth", x: 20, z: 20, radius: 2 });

    assert.equal(terrain.sampleAt(20, 20), 4);
    assert.equal(terrain.sampleAt(21, 20), 1);
    assert.deepEqual(sculptStamp(flatTerrain([0, 0, 3]), {
      tool: "smooth",
      x: 20,
      z: 20,
      radius: 8,
      strength: 1,
      falloff: "smooth"
    }), []);
  });

  test("smooth reads the neighbour chunk across the edge, from heights before the stamp", () => {
    const terrain = stamp(flatTerrain([0, 0, 0], [1, 0, 16]), {
      tool: "smooth",
      x: CHUNK_SAMPLES - 0.5,
      z: 10,
      radius: 1
    });

    assert.equal(terrain.sampleAt(CHUNK_SAMPLES - 1, 10), 2);
    assert.equal(terrain.sampleAt(CHUNK_SAMPLES, 10), 14);
  });
});
