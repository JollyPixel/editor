// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  voxelMapAssetKind,
  type VoxelMapState
} from "../../src/index.ts";

async function reloaded(
  state: VoxelMapState
): Promise<VoxelMapState> {
  const handler = voxelMapAssetKind();
  const copy = handler.create("map");
  handler.load(copy, await handler.serialize(state));

  return copy;
}

describe("voxelMapAssetKind summarizeChange", () => {
  test("counts the blocks placed, removed and replaced across layers and chunks", async() => {
    const handler = voxelMapAssetKind();
    const before = handler.create("map");
    before.world.addLayer("ground");
    before.world.addLayer("trees");
    for (const x of [0, 1, 2]) {
      before.world.placeVoxel("ground", { position: { x, y: 0, z: 0 }, blockId: 1 });
    }
    before.world.placeVoxel("trees", { position: { x: 0, y: 1, z: 0 }, blockId: 3 });
    before.world.placeVoxel("trees", { position: { x: 0, y: 2, z: 0 }, blockId: 3 });
    const after = await reloaded(before);

    assert.equal(handler.summarizeChange?.(before, after), null);

    after.world.removeVoxel("ground", { position: { x: 0, y: 0, z: 0 } });
    after.world.placeVoxel("ground", { position: { x: 1, y: 0, z: 0 }, blockId: 2 });
    after.world.placeVoxel("ground", { position: { x: 40, y: 0, z: 0 }, blockId: 1 });
    after.world.removeLayer("trees");

    assert.equal(
      handler.summarizeChange?.(before, after),
      "blocks 1 placed, 3 removed, 1 replaced"
    );
  });
});
