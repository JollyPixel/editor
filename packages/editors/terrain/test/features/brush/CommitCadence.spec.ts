// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ChunkCoord,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  COMMIT_CHUNKS,
  COMMIT_CHUNKS_INTERVAL,
  COMMIT_INTERVAL,
  CommitCadence
} from "#src/features/brush/model/CommitCadence.ts";

function tile(
  chunkX: number,
  index: number
): TileCoord {
  return TileCoord.fromIndex(new ChunkCoord(chunkX, 0), index);
}

describe("CommitCadence", () => {
  test(`a commit is due ${COMMIT_INTERVAL} s after the first touch, not counting idle time before it`, () => {
    const cadence = new CommitCadence();
    cadence.tick(COMMIT_INTERVAL);
    cadence.touch([tile(0, 0)]);
    cadence.tick(COMMIT_INTERVAL - 0.1);
    assert.equal(cadence.due, false);

    cadence.tick(0.1);
    assert.equal(cadence.due, true);
  });

  test(`a commit is due once ${COMMIT_CHUNKS} chunks are touched`, () => {
    const cadence = new CommitCadence();
    for (let chunk = 0; chunk < COMMIT_CHUNKS; chunk++) {
      cadence.tick(COMMIT_CHUNKS_INTERVAL);
      assert.equal(cadence.due, false);
      cadence.touch([tile(chunk, 0), tile(chunk, 1)]);
    }

    assert.equal(cadence.due, true);
  });

  test(`a commit for touched chunks waits ${COMMIT_CHUNKS_INTERVAL} s after the last one`, () => {
    const cadence = new CommitCadence();
    cadence.touch(Array.from({ length: COMMIT_CHUNKS }, (_, chunk) => tile(chunk, 0)));
    cadence.tick(COMMIT_CHUNKS_INTERVAL / 2);
    assert.equal(cadence.due, false);

    cadence.tick(COMMIT_CHUNKS_INTERVAL / 2);
    assert.equal(cadence.due, true);
  });
});
