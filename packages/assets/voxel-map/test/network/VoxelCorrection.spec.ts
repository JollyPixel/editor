// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AIR_BLOCK_ID,
  TilesetList,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  correctVoxelCommand,
  type VoxelMapNetworkCommand
} from "../../src/network/server.ts";

// CONSTANTS
const kHeader = {
  clientId: "A",
  seq: 4,
  timestamp: 10
};

function state() {
  const world = new VoxelWorld(16);
  world.restoreLayer({ id: "Ground", name: "Ground" });
  world.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: 3 });

  return {
    world,
    tilesets: new TilesetList()
  };
}

function removal(
  xs: number[],
  layerId = "Ground"
): VoxelMapNetworkCommand {
  return {
    ...kHeader,
    action: "voxels-removed",
    layerId,
    metadata: {
      entries: xs.map((x) => {
        return { position: { x, y: 0, z: 0 } };
      })
    }
  };
}

describe("correctVoxelCommand", () => {
  test("patches every cell of a refused write back to the server's value", () => {
    assert.deepStrictEqual(correctVoxelCommand(state(), removal([0, 1]), null), {
      ...kHeader,
      action: "voxels-patched",
      layerId: "Ground",
      metadata: {
        cells: [0, 0, 0, AIR_BLOCK_ID, 0, 1, 0, 0, 3, 0]
      }
    });
  });

  test("patches only the cells a narrowed write lost", () => {
    const correction = correctVoxelCommand(state(), removal([0, 1]), removal([0]));

    assert.deepStrictEqual(
      correction?.action === "voxels-patched" && correction.metadata.cells,
      [1, 0, 0, 3, 0]
    );
  });

  test("patches the second shape of a merged cell back too", () => {
    const merged = state();
    merged.world.setVoxel("Ground", {
      position: { x: 1, y: 0, z: 0 },
      blockId: 4,
      flipY: true,
      merge: true
    });

    const correction = correctVoxelCommand(merged, removal([1]), null);

    assert.deepStrictEqual(
      correction?.action === "voxels-patched" && correction.metadata,
      {
        cells: [1, 0, 0, 3, 0],
        partners: [0, 4, 16]
      }
    );
  });

  test("returns null for a write to a missing layer or a structural command", () => {
    assert.strictEqual(correctVoxelCommand(state(), removal([0], "missing"), null), null);
    assert.strictEqual(correctVoxelCommand(state(), {
      ...kHeader,
      action: "layer-moved",
      layerId: "Ground",
      metadata: { rank: "V" }
    }, null), null);
  });
});
