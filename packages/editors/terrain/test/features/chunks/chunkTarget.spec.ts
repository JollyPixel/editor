// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  ChunkCoord,
  Terrain
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { emptyGroundTarget } from "#src/features/chunks/model/chunkTarget.ts";

// CONSTANTS
const kHeight = 10;
const kDiagonal = Math.SQRT1_2;

function raisedTerrain(): Terrain {
  const terrain = new Terrain();
  terrain.addChunk(new ChunkCoord(0, 0), new Float32Array(CHUNK_SAMPLE_COUNT).fill(kHeight));

  return terrain;
}

describe("emptyGroundTarget", () => {
  test("aims at a plane at the neighbouring edge's height, not at the ground plane", () => {
    const ray = {
      origin: { x: 100, y: 30, z: 32 },
      direction: { x: kDiagonal, y: -kDiagonal, z: 0 }
    };
    const target = emptyGroundTarget(raisedTerrain(), ray);

    assert.equal(target?.coord.key, "1,0");
    assert.equal(target?.height, kHeight);
    assert.equal(target?.point.x, 100 + 30 - kHeight);
  });

  test("has no target over a chunk that already exists", () => {
    const ray = {
      origin: { x: 32, y: 30, z: 32 },
      direction: { x: 0, y: -1, z: 0 }
    };

    assert.equal(emptyGroundTarget(raisedTerrain(), ray), null);
  });
});
