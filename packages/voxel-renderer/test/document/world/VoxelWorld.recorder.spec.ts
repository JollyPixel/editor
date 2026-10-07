// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelWorld,
  type VoxelCellChange
} from "../../../src/document/world/index.ts";
import { worldHistory } from "../../helpers/history.ts";

// CONSTANTS
const kLayer = "Ground";
const kOrigin = { x: 0, y: 0, z: 0 };
const kNext = { x: 1, y: 0, z: 0 };

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer(kLayer);

  return world;
}

function cellChange(
  world: VoxelWorld,
  before: number,
  after: number
): VoxelCellChange {
  return {
    layerId: world.getLayer(kLayer)!.id,
    position: kOrigin,
    before,
    after,
    beforePartner: -1,
    afterPartner: -1
  };
}

describe("VoxelWorld recorder", () => {
  it("reports each changed cell with its layer and packed values", () => {
    const world = makeWorld();
    const recorded: VoxelCellChange[][] = [];
    world.addRecorder({
      record: (changes) => recorded.push(changes)
    });

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.removeVoxel(kLayer, { position: kOrigin });

    assert.deepEqual(recorded, [
      [cellChange(world, -1, 256)],
      [cellChange(world, 256, -1)]
    ]);
  });
  it("hands every change to each added recorder until it is removed", () => {
    const world = makeWorld();
    const first: number[] = [];
    const second: number[] = [];
    const recorder = {
      record: (changes: VoxelCellChange[]) => void second.push(changes.length)
    };
    world.addRecorder({
      record: (changes) => void first.push(changes.length)
    });
    world.addRecorder(recorder);

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    assert.strictEqual(world.removeRecorder(recorder), true);
    world.setVoxel(kLayer, { position: kNext, blockId: 1 });

    assert.deepEqual(first, [1, 1]);
    assert.deepEqual(second, [1]);
  });

  it("shows an undo to a recorder that includes unrecorded edits", () => {
    const world = makeWorld();
    const history = worldHistory(world);
    const recorded: VoxelCellChange[][] = [];
    world.addRecorder({
      record: (changes) => recorded.push(changes)
    }, { includeUnrecorded: true });

    world.setVoxel(kLayer, { position: kOrigin, blockId: 1 });
    world.transaction(() => history.undo());

    assert.deepEqual(recorded, [
      [cellChange(world, -1, 256)],
      [cellChange(world, 256, -1)]
    ]);
    assert.strictEqual(history.canUndo, false);
    assert.strictEqual(history.canRedo, true);
  });
});
