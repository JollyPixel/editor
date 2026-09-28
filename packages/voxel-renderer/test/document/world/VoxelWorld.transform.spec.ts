// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelWorld,
  voxelBlockId,
  voxelTransform
} from "../../../src/document/world/index.ts";
import { VoxelHistory } from "../../../src/document/VoxelHistory.ts";
import {
  VoxelTransform,
  type VoxelTransformOptions
} from "../../../src/document/geometry/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";
import { recordCommands } from "../../helpers/fakes.ts";
import { writeVoxel } from "../../helpers/world.ts";

// CONSTANTS
const kQuarterTurn = VoxelTransform.pack({ rotation: 1 });

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.setLayerPosition("Ground", { x: 10, y: 0, z: 0 });
  writeVoxel(world, "Ground", { x: 10, y: 0, z: 0 }, makeVoxelEntry(1));
  writeVoxel(world, "Ground", { x: 11, y: 0, z: 0 }, makeVoxelEntry(2, kQuarterTurn));
  writeVoxel(world, "Ground", { x: 10, y: 1, z: 2 }, makeVoxelEntry(3));

  return world;
}

function cellsOf(
  world: VoxelWorld
): number[][] {
  const layer = world.getLayer("Ground");
  assert.ok(layer !== undefined);

  return Array.from(layer.localVoxels(), ([x, y, z, packed]) => [
    x + layer.position.x,
    y + layer.position.y,
    z + layer.position.z,
    voxelBlockId(packed),
    voxelTransform(packed)
  ]).sort((a, b) => a[3] - b[3]);
}

describe("VoxelWorld.transformLayer", () => {
  it("turns the voxels around the content center and composes their transforms", () => {
    const world = makeWorld();

    world.transformLayer("Ground", { rotation: 1 });

    assert.deepEqual(cellsOf(world), [
      [10, 0, 1, 1, kQuarterTurn],
      [10, 0, 0, 2, VoxelTransform.pack({ rotation: 2 })],
      [12, 1, 1, 3, kQuarterTurn]
    ]);
    assert.deepEqual(world.getLayer("Ground")?.position, { x: 10, y: 0, z: 0 });
  });

  it("mirrors the voxels in place, keeping their bounds", () => {
    const world = makeWorld();

    world.transformLayer("Ground", { flipX: true, flipY: true });

    assert.deepEqual(cellsOf(world), [
      [11, 1, 0, 1, VoxelTransform.pack({ flipX: true, flipY: true })],
      [10, 1, 0, 2, VoxelTransform.pack({ rotation: 1, flipX: true, flipY: true })],
      [11, 0, 2, 3, VoxelTransform.pack({ flipX: true, flipY: true })]
    ]);
  });

  it("gives the same world cells wherever the layer origin sits", () => {
    const world = makeWorld();
    const far = makeWorld();
    far.rebaseLayer("Ground", { x: -500, y: 40, z: 300 });

    world.transformLayer("Ground", { rotation: 3 });
    far.transformLayer("Ground", { rotation: 3 });

    assert.deepEqual(cellsOf(far), cellsOf(world));
  });

  const kIdentitySequences: VoxelTransformOptions[][] = [
    Array(4).fill({ rotation: 1 }),
    [{ rotation: 1 }, { rotation: 3 }],
    [{ rotation: 3 }, { rotation: 3 }, { rotation: 2 }],
    [{ rotation: 2 }, { rotation: 2 }],
    [{ flipX: true }, { flipX: true }],
    [{ flipY: true }, { flipY: true }],
    [{ rotation: 1, flipZ: true }, { rotation: 1, flipZ: true }],
    [{ rotation: 1 }, { flipX: true }, { rotation: 1 }, { flipX: true }]
  ];
  for (const sequence of kIdentitySequences) {
    it(`restores the layer after ${JSON.stringify(sequence)}`, () => {
      const world = makeWorld();
      const original = cellsOf(world);

      world.transformLayer("Ground", sequence[0]);
      assert.notDeepEqual(cellsOf(world), original);
      for (const transform of sequence.slice(1)) {
        world.transformLayer("Ground", transform);
      }

      assert.deepEqual(cellsOf(world), original);
    });
  }

  it("emits nothing for the identity, an empty layer or an unknown layer", () => {
    const world = makeWorld();
    world.addLayer("Empty");
    const original = cellsOf(world);
    const commands = recordCommands(world);

    world.transformLayer("Ground", {});
    world.transformLayer("Empty", { rotation: 1 });
    world.transformLayer("NoSuch", { rotation: 1 });

    assert.deepEqual(commands, []);
    assert.deepEqual(cellsOf(world), original);
  });

  it("is undone and redone as one history step", () => {
    const world = makeWorld();
    const history = new VoxelHistory(world, { enabled: true });
    const original = cellsOf(world);

    world.transformLayer("Ground", { rotation: 3, flipX: true });
    const transformed = cellsOf(world);

    assert.equal(history.undo(), true);
    assert.deepEqual(cellsOf(world), original);
    assert.equal(history.canUndo, false);

    assert.equal(history.redo(), true);
    assert.deepEqual(cellsOf(world), transformed);
  });
});
