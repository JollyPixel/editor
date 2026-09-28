// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../../src/document/world/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";
import {
  withoutId,
  writeVoxel
} from "../../helpers/world.ts";

describe("VoxelWorld — cloneLayer", () => {
  it("derives an unused name from the source when none is given", () => {
    const world = new VoxelWorld(8);
    world.addLayer("layer");

    assert.equal(world.cloneLayer("layer")?.name, "layer (1)");
    assert.equal(world.cloneLayer("layer")?.name, "layer (2)");
    assert.equal(world.cloneLayer("layer (1)")?.name, "layer (3)");
  });

  it("de-duplicates a requested name that is already taken", () => {
    const world = new VoxelWorld(8);
    world.addLayer("A");
    world.addLayer("B");

    assert.equal(world.cloneLayer("A", { name: "B" })?.name, "B (1)");
  });

  it("inserts the copy directly above the source and renumbers the stack", () => {
    const world = new VoxelWorld(8);
    world.addLayer("Bottom");
    world.addLayer("Middle");
    world.addLayer("Top");

    world.cloneLayer("Middle", { name: "Copy" });

    assert.deepEqual(
      world.getLayers().map((layer) => layer.name),
      ["Top", "Copy", "Middle", "Bottom"]
    );
    assert.deepEqual(
      world.getLayers().map((layer) => layer.order),
      [3, 2, 1, 0]
    );
  });

  it("gives the copy an id of its own", () => {
    const world = new VoxelWorld(8);
    const original = world.addLayer("A");

    assert.notEqual(world.cloneLayer("A")?.id, original.id);
  });

  it("applies the overrides it is handed to the copy", () => {
    const world = new VoxelWorld(8);
    const original = world.addLayer("A");

    const clone = world.cloneLayer("A", { name: "A_1", visible: false });

    assert.ok(clone);
    assert.ok(world.getLayer("A"));
    assert.deepEqual(withoutId(clone), {
      ...withoutId(original),
      name: "A_1",
      order: original.order + 1,
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
  it("copies the source voxels into the target and consumes the source", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Target");
    world.addLayer("Source");
    const moved = makeVoxelEntry(3, 0);
    writeVoxel(world, "Source", { x: 1, y: 0, z: 0 }, moved);

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.equal(world.getLayer("Source"), undefined);
    assert.deepEqual(
      world.getLayer("Target")?.getVoxelAt({ x: 1, y: 0, z: 0 }),
      moved
    );
    assert.deepEqual(
      world.getLayers().map((layer) => layer.order),
      [0]
    );
  });

  it("keeps the higher layer's voxels when merging down", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Target");
    world.addLayer("Source");
    const winner = makeVoxelEntry(9, 2);
    writeVoxel(world, "Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    writeVoxel(world, "Source", { x: 0, y: 0, z: 0 }, winner);

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.deepEqual(
      world.getLayer("Target")?.getVoxelAt({ x: 0, y: 0, z: 0 }),
      winner
    );
  });

  it("keeps the higher layer's voxels when merging up", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Source");
    world.addLayer("Target");
    const winner = makeVoxelEntry(9, 2);
    writeVoxel(world, "Source", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    writeVoxel(world, "Target", { x: 0, y: 0, z: 0 }, winner);

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.deepEqual(
      world.getLayer("Target")?.getVoxelAt({ x: 0, y: 0, z: 0 }),
      winner
    );
  });

  it("folds the source properties in behind the target's own", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Target", { properties: { biome: "forest", tag: "keep" } });
    world.addLayer("Source", { properties: { biome: "desert", seed: 7 } });

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.deepEqual(world.getLayer("Target")?.properties, {
      biome: "forest",
      tag: "keep",
      seed: 7
    });
  });

  it("merges nothing when either side is unknown, or both are the same", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Known");

    assert.equal(world.mergeLayer("NoSuch", "Known"), false);
    assert.equal(world.mergeLayer("Known", "NoSuch"), false);
    assert.equal(world.mergeLayer("Known", "Known"), false);
    assert.ok(world.getLayer("Known"));
  });
});

describe("VoxelWorld — mergeAllLayers", () => {
  it("collapses the stack into one layer, higher priority winning", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Base");
    world.addLayer("Top");
    world.addLayer("Above");
    const winner = makeVoxelEntry(9, 0);
    writeVoxel(world, "Base", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    writeVoxel(world, "Top", { x: 0, y: 0, z: 0 }, winner);

    const merged = world.mergeAllLayers();

    assert.equal(merged.length, 1);
    assert.deepEqual(world.getLayers(), merged);
    assert.deepEqual(merged[0].getVoxelAt({ x: 0, y: 0, z: 0 }), winner);
  });

  it("hands back the only layer untouched", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Only");
    const entry = makeVoxelEntry(2, 0);
    writeVoxel(world, "Only", { x: 0, y: 0, z: 0 }, entry);

    assert.deepEqual(world.mergeAllLayers(), [layer]);
    assert.equal(world.getLayers().length, 1);
    assert.deepEqual(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), entry);
  });

  it("has nothing to merge in an empty world", () => {
    assert.deepEqual(new VoxelWorld(4).mergeAllLayers(), []);
  });

  it("folds merged-away properties behind the target's own", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Base", { properties: { biome: "forest" } });
    world.addLayer("Top", { properties: { biome: "desert", seed: 7 } });

    const [merged] = world.mergeAllLayers();

    assert.deepEqual(merged.properties, { biome: "forest", seed: 7 });
  });

  it("merges the layers on each side of an excluded one separately", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    world.addLayer("Ground");
    const water = world.addLayer("Water");
    const decor = world.addLayer("Decor");
    world.addLayer("Top");

    const merged = world.mergeAllLayers({ except: ["Water"] });

    assert.deepEqual(merged, [decor, base]);
    assert.deepEqual(world.getLayers(), [decor, water, base]);
  });

  it("keeps an excluded layer between the layers it sat between", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Base");
    world.addLayer("Ground");
    world.addLayer("Water");
    world.addLayer("Decor");
    world.addLayer("Top");
    const overGround = { x: 0, y: 0, z: 0 };
    const underTop = { x: 1, y: 0, z: 0 };
    const water = makeVoxelEntry(5, 0);
    const top = makeVoxelEntry(9, 0);
    writeVoxel(world, "Ground", overGround, makeVoxelEntry(1, 0));
    writeVoxel(world, "Water", overGround, water);
    writeVoxel(world, "Water", underTop, makeVoxelEntry(5, 0));
    writeVoxel(world, "Top", underTop, top);

    world.mergeAllLayers({ except: ["Water"] });

    assert.equal(world.getLayers().length, 3);
    assert.deepEqual(world.getVoxelAt(overGround), water);
    assert.deepEqual(world.getVoxelAt(underTop), top);
  });

  it("merges nothing when every layer is excluded", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");

    assert.deepEqual(world.mergeAllLayers({ except: ["Base", "Top"] }), []);
    assert.deepEqual(world.getLayers(), [top, base]);
  });

  it("ignores excluded names that match no layer", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    world.addLayer("Top");

    assert.deepEqual(world.mergeAllLayers({ except: ["NoSuch"] }), [base]);
  });
});
