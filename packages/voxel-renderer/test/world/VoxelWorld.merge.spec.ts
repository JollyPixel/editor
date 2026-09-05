// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";
import { withoutId } from "../helpers/world.ts";

describe("VoxelWorld — cloneLayer", () => {
  it("copies a layer under a new name, leaving the original in place", () => {
    const world = new VoxelWorld(8);
    const original = world.addLayer("A");

    const clone = world.cloneLayer("A", { name: "A_1" });

    assert.ok(clone);
    const expected = { ...withoutId(original), name: "A_1" };
    assert.deepEqual(withoutId(clone), expected);
    assert.deepEqual(withoutId(world.getLayer("A_1")!), expected);
    assert.ok(world.getLayer("A"));
  });

  it("applies the overrides it is handed to the copy", () => {
    const world = new VoxelWorld(8);
    const original = world.addLayer("A");

    const clone = world.cloneLayer("A", { name: "A_1", visible: false });

    assert.ok(clone);
    assert.deepEqual(withoutId(clone), {
      ...withoutId(original),
      name: "A_1",
      visible: false
    });
  });

  it("clones nothing when the source layer is unknown", () => {
    const world = new VoxelWorld(8);

    assert.equal(world.cloneLayer("A", { name: "A_1" }), undefined);
    assert.equal(world.getLayer("A_1"), undefined);
  });
});

describe("VoxelWorld — mergeLayer", () => {
  it("copies the source voxels into the target, source winning conflicts", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Source");
    const target = world.addLayer("Target");
    const moved = makeVoxelEntry(3, 0);
    const winner = makeVoxelEntry(9, 2);
    world.setVoxelAt("Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.setVoxelAt("Source", { x: 0, y: 0, z: 0 }, winner);
    world.setVoxelAt("Source", { x: 1, y: 0, z: 0 }, moved);

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.deepEqual(target.getVoxelAt({ x: 0, y: 0, z: 0 }), winner);
    assert.deepEqual(target.getVoxelAt({ x: 1, y: 0, z: 0 }), moved);
  });

  it("merges nothing when either side is unknown", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Known");

    assert.equal(world.mergeLayer("NoSuch", "Known"), false);
    assert.equal(world.mergeLayer("Known", "NoSuch"), false);
  });
});

describe("VoxelWorld — mergeAllLayers", () => {
  it("collapses the stack into one layer, higher priority winning", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Base");
    world.addLayer("Top");
    world.addLayer("Above");
    const winner = makeVoxelEntry(9, 0);
    world.setVoxelAt("Base", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.setVoxelAt("Top", { x: 0, y: 0, z: 0 }, winner);

    const merged = world.mergeAllLayers();

    assert.ok(merged);
    assert.equal(world.getLayers().length, 1);
    assert.deepEqual(merged.getVoxelAt({ x: 0, y: 0, z: 0 }), winner);
  });

  it("hands back the only layer untouched", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Only");
    const entry = makeVoxelEntry(2, 0);
    world.setVoxelAt("Only", { x: 0, y: 0, z: 0 }, entry);

    assert.equal(world.mergeAllLayers(), layer);
    assert.equal(world.getLayers().length, 1);
    assert.deepEqual(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), entry);
  });

  it("has nothing to merge in an empty world", () => {
    assert.equal(new VoxelWorld(4).mergeAllLayers(), null);
  });
});
