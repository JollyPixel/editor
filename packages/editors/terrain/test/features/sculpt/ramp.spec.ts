// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLE_COUNT,
  ChunkCoord,
  Terrain,
  TILE_SAMPLE_COUNT,
  TileCoord
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { rampStamp } from "#src/features/sculpt/model/rampStamp.ts";
import { RampStroke } from "#src/features/sculpt/model/RampStroke.ts";
import { SculptSettings } from "#src/features/sculpt/model/SculptSettings.ts";
import {
  createTerrainHistory,
  TERRAIN_HISTORY_SCOPE
} from "#src/shared/terrainHistory.ts";

describe("ramp", () => {
  test("pulls the samples within the width toward the line between its ends, and none past them", () => {
    const terrain = new Terrain();
    terrain.addChunk(new ChunkCoord(0, 0), new Float32Array(CHUNK_SAMPLE_COUNT));
    for (const { tile, heights } of rampStamp(terrain, {
      from: { x: 10, z: 32, height: 0 },
      to: { x: 50, z: 32, height: 20 },
      radius: 4,
      strength: 1,
      falloff: "constant"
    })) {
      terrain.writeTile(tile, heights);
    }

    assert.deepEqual(
      [[30, 32], [30, 35], [50, 32], [30, 37], [5, 32], [55, 32]].map(([x, z]) => terrain.sampleAt(x, z)),
      [10, 10, 20, 0, 0, 0]
    );
  });

  test("a drag writes one ramp on release up to the height under its end, undone as one step", () => {
    const document = new TerrainDocument();
    document.addChunk(0, 0);
    const raised = new Float32Array(TILE_SAMPLE_COUNT).fill(8);
    document.patchTiles([{ tile: TileCoord.containing(30, 40), heights: raised }]);
    const preview = new TerrainPreview(document);
    const history = createTerrainHistory(document);
    const settings = new SculptSettings();
    settings.update({ size: 3, strength: 1, falloff: "constant" });
    const options = { preview, history, settings };

    const still = new RampStroke(options, { point: { x: 8, z: 40 }, height: 0, lower: false });
    still.end();
    const stroke = new RampStroke(options, { point: { x: 8, z: 40 }, height: 0, lower: false });
    stroke.update({ x: 30, z: 40 });
    assert.equal(document.terrain.sampleAt(19, 40), 8);
    stroke.end();
    stroke.update({ x: 40, z: 40 });

    assert.deepEqual([8, 19, 30].map((x) => document.terrain.sampleAt(x, 40)), [0, 4, 8]);
    assert.equal(history.state(TERRAIN_HISTORY_SCOPE).undoCount, 1);
    history.undo(TERRAIN_HISTORY_SCOPE);
    assert.equal(document.terrain.sampleAt(19, 40), 8);
  });
});
