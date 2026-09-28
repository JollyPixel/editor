// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  VoxelWorld,
  type VoxelCoord,
  type VoxelTemplate
} from "../../../src/document/world/index.ts";
import { VoxelHistory } from "../../../src/document/VoxelHistory.ts";
import { VoxelTransform } from "../../../src/document/geometry/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";
import { recordCommands } from "../../helpers/fakes.ts";
import { writeVoxel } from "../../helpers/world.ts";

// CONSTANTS
const kQuarterTurn = VoxelTransform.pack({ rotation: 1 });

function makeWorld(): VoxelWorld {
  const world = new VoxelWorld(4);
  world.addLayer("Target");
  world.addLayer("Source");
  writeVoxel(world, "Source", { x: 10, y: 2, z: 5 }, makeVoxelEntry(1));
  writeVoxel(world, "Source", { x: 11, y: 2, z: 5 }, makeVoxelEntry(2, kQuarterTurn));
  writeVoxel(world, "Source", { x: 12, y: 3, z: 5 }, makeVoxelEntry(3));

  return world;
}

function voxelsOf(
  template: VoxelTemplate | undefined
): number[][] {
  assert.ok(template !== undefined);

  return Array.from(template.localVoxels(), ([x, y, z, packed]) => [x, y, z, packed >>> 8])
    .sort((a, b) => a[3] - b[3]);
}

function blockAt(
  world: VoxelWorld,
  position: VoxelCoord
): [number, number] | undefined {
  const entry = world.getLayer("Target")?.getVoxelAt(position);

  return entry && [entry.blockId, entry.transform];
}

describe("VoxelWorld.templates.createFromLayer", () => {
  it("moves the lowest corner to the origin and pivots on the bottom center", () => {
    const world = makeWorld();

    const template = world.templates.createFromLayer("Source", { name: "Steps" });

    assert.deepEqual(voxelsOf(template), [
      [0, 0, 0, 1],
      [1, 0, 0, 2],
      [2, 1, 0, 3]
    ]);
    assert.deepEqual(template?.size, { x: 3, y: 2, z: 1 });
    assert.deepEqual(template?.pivot, { x: 1, y: 0, z: 0 });
  });

  it("captures world positions, so the layer offset is applied", () => {
    const world = makeWorld();
    world.setLayerPosition("Source", { x: 100, y: 0, z: 0 });

    const template = world.templates.createFromLayer("Source", {
      name: "Steps",
      pivot: { x: 112, y: 2, z: 5 }
    });

    assert.deepEqual(template?.pivot, { x: 2, y: 0, z: 0 });
  });

  it("keeps only the voxels inside the half-open bounds", () => {
    const world = makeWorld();

    const template = world.templates.createFromLayer("Source", {
      name: "Pair",
      bounds: {
        min: { x: 10, y: 0, z: 0 },
        max: { x: 12, y: 8, z: 8 }
      }
    });

    assert.deepEqual(voxelsOf(template), [
      [0, 0, 0, 1],
      [1, 0, 0, 2]
    ]);
  });

  it("creates nothing for an unknown layer or an empty capture", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    assert.equal(world.templates.createFromLayer("NoSuch", { name: "A" }), undefined);
    assert.equal(world.templates.createFromLayer("Target", { name: "B" }), undefined);
    assert.equal(world.templates.size, 0);
    assert.deepEqual(commands, []);
  });

  it("never hands out an id a template already holds", () => {
    const world = makeWorld();
    world.templates.createFromLayer("Source", { name: "A", id: "template_1" });

    world.templates.createFromLayer("Source", { name: "B" });
    world.templates.createFromLayer("Source", { name: "C" });

    assert.deepEqual(
      world.templates.toArray().map(({ id }) => id).sort(),
      ["template_0", "template_1", "template_2"]
    );
  });
});

describe("VoxelWorld.templates.update", () => {
  it("renames and moves the pivot without touching the voxels", () => {
    const world = makeWorld();
    const { id } = world.templates.createFromLayer("Source", { name: "Steps" })!;

    assert.equal(world.templates.update(id, {
      name: "Stairs",
      pivot: { x: 0, y: 0, z: 0 }
    }), true);

    const template = world.templates.get(id);
    assert.equal(template?.name, "Stairs");
    assert.deepEqual(template?.pivot, { x: 0, y: 0, z: 0 });
    assert.equal(template?.voxelCount, 3);
  });

  it("changes nothing for an unknown template", () => {
    const world = makeWorld();
    const commands = recordCommands(world);

    assert.equal(world.templates.update("nope", { name: "X" }), false);
    assert.equal(world.templates.remove("nope"), false);
    assert.deepEqual(commands, []);
  });
});

describe("VoxelWorld.templates.place", () => {
  it("puts the pivot on the position", () => {
    const world = makeWorld();
    const { id } = world.templates.createFromLayer("Source", { name: "Steps" })!;

    assert.equal(world.templates.place(id, {
      layerName: "Target",
      position: { x: 0, y: 10, z: 0 }
    }), true);

    assert.deepEqual(blockAt(world, { x: -1, y: 10, z: 0 }), [1, 0]);
    assert.deepEqual(blockAt(world, { x: 0, y: 10, z: 0 }), [2, kQuarterTurn]);
    assert.deepEqual(blockAt(world, { x: 1, y: 11, z: 0 }), [3, 0]);
  });

  it("turns the voxels around the pivot and composes their transforms", () => {
    const world = makeWorld();
    const { id } = world.templates.createFromLayer("Source", { name: "Steps" })!;

    world.templates.place(id, {
      layerName: "Target",
      position: { x: 0, y: 0, z: 0 },
      transform: { rotation: 1 }
    });

    assert.deepEqual(blockAt(world, { x: 0, y: 0, z: 1 }), [1, kQuarterTurn]);
    assert.deepEqual(blockAt(world, { x: 0, y: 0, z: 0 }), [2, VoxelTransform.pack({ rotation: 2 })]);
    assert.deepEqual(blockAt(world, { x: 0, y: 1, z: -1 }), [3, kQuarterTurn]);
  });

  it("fills only empty cells when overwrite is off", () => {
    const world = makeWorld();
    const { id } = world.templates.createFromLayer("Source", { name: "Steps" })!;
    writeVoxel(world, "Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(9));

    world.templates.place(id, {
      layerName: "Target",
      position: { x: 0, y: 0, z: 0 },
      overwrite: false
    });

    assert.deepEqual(blockAt(world, { x: 0, y: 0, z: 0 }), [9, 0]);
    assert.deepEqual(blockAt(world, { x: -1, y: 0, z: 0 }), [1, 0]);
  });

  it("writes nothing for an unknown template or layer, or when every cell is taken", () => {
    const world = makeWorld();
    const { id } = world.templates.createFromLayer("Source", { name: "Steps" })!;
    const commands = recordCommands(world);
    const position = { x: 11, y: 2, z: 5 };

    assert.equal(world.templates.place("nope", { layerName: "Target", position }), false);
    assert.equal(world.templates.place(id, { layerName: "NoSuch", position }), false);
    assert.equal(world.templates.place(id, { layerName: "Source", position, overwrite: false }), false);
    assert.deepEqual(commands, []);
  });

  it("is undone as one history step", () => {
    const world = makeWorld();
    const history = new VoxelHistory(world, { enabled: true });
    const { id } = world.templates.createFromLayer("Source", { name: "Steps" })!;

    world.templates.place(id, {
      layerName: "Target",
      position: { x: 0, y: 0, z: 0 }
    });
    assert.equal(world.getLayer("Target")?.voxelCount, 3);

    assert.equal(history.undo(), true);
    assert.equal(world.getLayer("Target")?.voxelCount, 0);
    assert.equal(history.canUndo, false);
  });
});
