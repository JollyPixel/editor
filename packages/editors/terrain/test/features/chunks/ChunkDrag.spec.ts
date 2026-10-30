// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  type TerrainReader
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { ChunkDrag } from "#src/features/chunks/model/ChunkDrag.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

function chunkKeys(
  terrain: TerrainReader
): string[] {
  return [...terrain.chunks()].map(({ coord }) => coord.key).sort();
}

function chunkCentre(
  x: number,
  z: number
) {
  return {
    x: (x + 0.5) * CHUNK_SAMPLES,
    z: (z + 0.5) * CHUNK_SAMPLES
  };
}

function dragSetup(
  chunks: readonly (readonly [number, number])[]
) {
  const document = new TerrainDocument();
  for (const [x, z] of chunks) {
    document.addChunk(x, z);
  }
  const history = createTerrainHistory(document);

  return { document, history };
}

describe("ChunkDrag", () => {
  test("a diagonal drag past empty ground adds a connected run of chunks, undone as one step", () => {
    const { document, history } = dragSetup([[0, 0]]);
    const drag = new ChunkDrag({ document, history }, { mode: "add", tier: 1 }, chunkCentre(1, 0));
    drag.moveTo(chunkCentre(3, 1));
    drag.end();

    assert.deepEqual(chunkKeys(document.terrain), ["0,0", "1,0", "2,0", "2,1", "3,1"]);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);

    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(chunkKeys(document.terrain), ["0,0"]);
  });

  test("a remove drag removes the chunks it crosses but keeps the last one", () => {
    const { document, history } = dragSetup([[0, 0], [1, 0]]);
    const drag = new ChunkDrag({ document, history }, { mode: "remove", tier: 1 }, chunkCentre(0, 0));
    drag.moveTo(chunkCentre(2, 0));
    drag.end();

    assert.deepEqual(chunkKeys(document.terrain), ["1,0"]);

    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(chunkKeys(document.terrain), ["0,0", "1,0"]);
  });

  test("a detail drag sets the tier of each chunk it crosses, undone as one step", () => {
    const { document, history } = dragSetup([[0, 0], [1, 0], [2, 0]]);
    function tiers(): number[] {
      return [0, 1, 2].map((x) => document.terrain.chunk(new ChunkCoord(x, 0))!.tier);
    }
    const drag = new ChunkDrag({ document, history }, { mode: "detail", tier: 4 }, chunkCentre(0, 0));
    drag.moveTo(chunkCentre(1, 0));
    drag.end();

    assert.deepEqual(tiers(), [4, 4, 1]);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);

    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.deepEqual(tiers(), [1, 1, 1]);
  });
});
