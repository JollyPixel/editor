// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  TILE_SAMPLE_COUNT,
  TileCoord,
  type TilePatch
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  COMMIT_CHUNKS,
  COMMIT_INTERVAL,
  StrokeRecorder
} from "#src/features/sculpt/model/StrokeRecorder.ts";

function patch(
  chunkX: number,
  index: number,
  height: number
): TilePatch {
  return {
    tile: TileCoord.fromIndex(new ChunkCoord(chunkX, 0), index),
    heights: new Float32Array(TILE_SAMPLE_COUNT).fill(height)
  };
}

describe("StrokeRecorder", () => {
  test("a tile keeps the heights it had before the stroke first touched it", () => {
    const recorder = new StrokeRecorder();
    recorder.record([patch(0, 3, 1), patch(0, 4, 1)]);
    recorder.record([patch(0, 3, 2)]);
    const taken = recorder.take();

    assert.deepEqual(
      taken.map(({ tile, heights }) => [tile.key, heights[0]]),
      [["0,0:3", 1], ["0,0:4", 1]]
    );
    assert.equal(recorder.size, 0);
    assert.equal(recorder.due, false);
  });

  test(`a commit is due after ${COMMIT_INTERVAL} s or once ${COMMIT_CHUNKS} chunks are touched`, () => {
    const recorder = new StrokeRecorder();
    recorder.tick(COMMIT_INTERVAL);
    recorder.record([patch(0, 0, 0)]);
    recorder.tick(COMMIT_INTERVAL - 0.1);
    assert.equal(recorder.due, false);
    recorder.tick(0.1);
    assert.equal(recorder.due, true);

    recorder.take();
    for (let chunk = 0; chunk < COMMIT_CHUNKS; chunk++) {
      assert.equal(recorder.due, false);
      recorder.record([patch(chunk, 0, 0), patch(chunk, 1, 0)]);
    }
    assert.equal(recorder.due, true);
  });
});
