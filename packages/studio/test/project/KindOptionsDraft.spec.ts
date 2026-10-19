// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { KindOptionsDraft } from "../../src/project/KindOptionsDraft.ts";

// CONSTANTS
const kVoxelMap = "@jolly-pixel/asset.voxel-map";
const kTileSize = {
  path: ["blockset", "tileSize"],
  label: "Blockset › Tile size"
};
const kChunkSize = {
  path: ["voxelmap", "chunkSize"],
  label: "Voxelmap › Chunk size"
};

describe("KindOptionsDraft", () => {
  test("writes a field at its path and keeps the other options and packages", () => {
    const draft = KindOptionsDraft.from([
      {
        name: kVoxelMap,
        options: {
          voxelmap: {
            chunkSize: 16,
            snapshot: {
              delay: 5_000
            }
          }
        },
        fields: [kTileSize, kChunkSize]
      },
      {
        name: "@acme/asset.sound",
        options: {
          rate: 44_100
        },
        fields: []
      }
    ]);

    const edited = draft
      .with(kVoxelMap, kTileSize, 32)
      .with(kVoxelMap, kChunkSize, 32);

    assert.equal(draft.value(kVoxelMap, kTileSize), undefined);
    assert.equal(edited.value(kVoxelMap, kChunkSize), 32);
    assert.deepEqual(edited.toJSON(), {
      [kVoxelMap]: {
        voxelmap: {
          chunkSize: 32,
          snapshot: {
            delay: 5_000
          }
        },
        blockset: {
          tileSize: 32
        }
      },
      "@acme/asset.sound": {
        rate: 44_100
      }
    });
  });
});
