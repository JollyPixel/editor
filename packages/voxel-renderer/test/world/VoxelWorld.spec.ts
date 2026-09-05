// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import { FACE } from "../../src/utils/math.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";

describe("VoxelWorld — layer lifecycle", () => {
  it("starts empty and finds a layer back by name", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.getLayers().length, 0);

    const layer = world.addLayer("Ground");

    assert.equal(layer.name, "Ground");
    assert.equal(world.getLayer("Ground"), layer);
    assert.equal(world.getLayer("NoSuchLayer"), undefined);
  });

  it("hands layers back highest-priority first", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");

    assert.deepEqual(world.getLayers(), [top, base]);
  });

  it("removes a layer and reports whether there was one", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");

    assert.equal(world.removeLayer("Ground"), true);
    assert.equal(world.getLayer("Ground"), undefined);
    assert.equal(world.getLayers().length, 0);

    assert.equal(world.removeLayer("Ground"), false);
  });

  it("drops every layer, and the removals still pending, on clear", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");
    world.setVoxelAt("A", { x: 0, y: 0, z: 0 }, makeVoxelEntry());
    world.removeLayer("A");

    world.clear();

    assert.equal(world.getLayers().length, 0);
    assert.deepEqual([...world.getAllChunksToBeRemoved()], []);
  });
});

describe("VoxelWorld — layer ordering", () => {
  it("swaps a layer's priority with its neighbour in the stack", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");

    // "up" walks towards lower priority, "down" towards higher.
    world.moveLayer("Top", "up");
    assert.deepEqual([top.order, base.order], [0, 1]);

    world.moveLayer("Top", "down");
    assert.deepEqual([top.order, base.order], [1, 0]);
  });

  it("stays put at either end of the stack, or for an unknown name", () => {
    const world = new VoxelWorld(4);
    const only = world.addLayer("Only");
    const { order } = only;

    world.moveLayer("Only", "up");
    world.moveLayer("Only", "down");
    assert.doesNotThrow(() => world.moveLayer("NoSuch", "up"));

    assert.equal(only.order, order);
  });
});

describe("VoxelWorld — voxel access", () => {
  it("round-trips a voxel through the named layer", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const entry = makeVoxelEntry(5);

    world.setVoxelAt("Ground", { x: 2, y: 1, z: 3 }, entry);
    assert.deepEqual(world.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);

    world.removeVoxelAt("Ground", { x: 2, y: 1, z: 3 });
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 3 }), undefined);
  });

  it("reads nothing out of an empty world", () => {
    const world = new VoxelWorld(4);

    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(world.getVoxelWithLayerAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(world.getVoxelNeighbour({ x: 0, y: 0, z: 0 }, FACE.PosX), undefined);
  });

  it("refuses to write to a layer that does not exist, but tolerates erasing from one", () => {
    const world = new VoxelWorld(4);

    assert.throws(
      () => world.setVoxelAt("NoSuch", { x: 0, y: 0, z: 0 }, makeVoxelEntry()),
      /layer "NoSuch" does not exist/
    );
    assert.doesNotThrow(
      () => world.removeVoxelAt("NoSuch", { x: 0, y: 0, z: 0 })
    );
  });

  it("steps one cell along a face to reach a neighbour", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const entry = makeVoxelEntry(3);
    world.setVoxelAt("Ground", { x: 1, y: 0, z: 0 }, entry);

    assert.deepEqual(
      world.getVoxelNeighbour({ x: 0, y: 0, z: 0 }, FACE.PosX),
      entry
    );
  });
});

describe("VoxelWorld — compositing", () => {
  /** Two stacked layers, both holding a voxel at the origin. */
  function stacked() {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");
    const baseEntry = makeVoxelEntry(1);
    const topEntry = makeVoxelEntry(2);
    base.setVoxelAt({ x: 0, y: 0, z: 0 }, baseEntry);
    top.setVoxelAt({ x: 0, y: 0, z: 0 }, topEntry);

    return { world, base, top, baseEntry, topEntry };
  }

  it("takes the voxel from the highest-priority layer that has one", () => {
    const { world, topEntry } = stacked();

    assert.deepEqual(world.getVoxelAt({ x: 0, y: 0, z: 0 }), topEntry);
  });

  it("falls through to a lower layer where the higher one is empty", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    world.addLayer("Top");
    const entry = makeVoxelEntry(1);
    base.setVoxelAt({ x: 5, y: 0, z: 0 }, entry);

    assert.deepEqual(world.getVoxelAt({ x: 5, y: 0, z: 0 }), entry);
  });

  it("skips a layer that is invisible or fully transparent", () => {
    for (const hide of [
      (layer: { visible: boolean; }) => void (layer.visible = false),
      (layer: { opacity: number; }) => void (layer.opacity = 0)
    ]) {
      const { world, top, baseEntry } = stacked();
      hide(top);

      assert.deepEqual(world.getVoxelAt({ x: 0, y: 0, z: 0 }), baseEntry);
    }
  });

  it("keeps a partly transparent layer in the running", () => {
    const { world, top, topEntry } = stacked();
    top.opacity = 0.5;

    assert.deepEqual(world.getVoxelAt({ x: 0, y: 0, z: 0 }), topEntry);
  });

  it("names the layer the winning voxel came from", () => {
    const { world, top, base, topEntry } = stacked();

    const winner = world.getVoxelWithLayerAt({ x: 0, y: 0, z: 0 });
    assert.deepEqual(winner?.entry, topEntry);
    assert.equal(winner?.layer, top);

    top.opacity = 0;
    assert.equal(world.getVoxelWithLayerAt({ x: 0, y: 0, z: 0 })?.layer, base);
  });
});

describe("VoxelWorld — chunk size", () => {
  it("defaults to 16 and takes any power of two", () => {
    assert.equal(new VoxelWorld().chunkSize, 16);
    assert.equal(new VoxelWorld(8).chunkSize, 8);
  });

  it("rejects a size that is not a power of two", () => {
    assert.throws(
      () => new VoxelWorld(10),
      /chunkSize must be a power of two, received 10/
    );
  });
});
