// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { KindOptionsDraft } from "../../src/project/KindOptionsDraft.ts";
import type { KindOptionField } from "../../shared/api/project.ts";

// CONSTANTS
const kVoxelMap = "@jolly-pixel/asset.voxel-map";
const kTileSize: KindOptionField = {
  type: "number",
  path: ["blockset", "tileSize"],
  label: "Tile size"
};
const kChunkSize: KindOptionField = {
  type: "number",
  path: ["voxelmap", "chunkSize"],
  label: "Chunk size"
};
const kPixelArt = "@jolly-pixel/asset.pixel-art";
const kDefaultSize: KindOptionField = {
  type: "vector2",
  path: ["defaultSize"],
  label: "Default size",
  default: {
    x: 32,
    y: 32
  }
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
        sections: []
      },
      {
        name: "@acme/asset.sound",
        options: {
          rate: 44_100
        },
        sections: []
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

  test("reads a vector2 only when both axes are numbers and writes both axes", () => {
    const draft = KindOptionsDraft.from([
      {
        name: kPixelArt,
        options: {
          defaultSize: {
            x: 128
          }
        },
        sections: []
      }
    ]);

    const edited = draft.with(kPixelArt, kDefaultSize, {
      x: 64,
      y: 32
    });

    assert.equal(draft.value(kPixelArt, kDefaultSize), undefined);
    assert.deepEqual(edited.value(kPixelArt, kDefaultSize), {
      x: 64,
      y: 32
    });
    assert.deepEqual(edited.toJSON(), {
      [kPixelArt]: {
        defaultSize: {
          x: 64,
          y: 32
        }
      }
    });
  });
});
