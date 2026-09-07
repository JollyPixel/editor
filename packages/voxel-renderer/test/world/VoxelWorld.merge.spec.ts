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
    assert.deepEqual(withoutId(clone), {
      ...withoutId(original),
      name: "A_1",
      order: original.order + 1
    });
    assert.ok(world.getLayer("A"));
    assert.ok(world.getLayer("A_1"));
  });

  it("carries the source voxels over to the copy", () => {
    const world = new VoxelWorld(4);
    const entry = makeVoxelEntry(7, 3);
    world.addLayer("A");
    world.setVoxelAt("A", { x: 1, y: 2, z: 3 }, entry);

    const clone = world.cloneLayer("A");

    assert.ok(clone);
    assert.deepEqual(clone.getVoxelAt({ x: 1, y: 2, z: 3 }), entry);
    assert.equal(clone.chunkCount, 1);
  });

  it("leaves the source untouched when the copy is edited", () => {
    const world = new VoxelWorld(4);
    const source = world.addLayer("A");
    world.setVoxelAt("A", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));

    const clone = world.cloneLayer("A")!;
    clone.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(5, 0));
    clone.setVoxelAt({ x: 3, y: 0, z: 0 }, makeVoxelEntry(6, 0));

    assert.equal(source.getVoxelAt({ x: 0, y: 0, z: 0 })?.blockId, 1);
    assert.equal(source.getVoxelAt({ x: 3, y: 0, z: 0 }), undefined);
  });

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

  it("emits the resolved name so peers replay the same clone", () => {
    const world = new VoxelWorld(8);
    world.addLayer("layer");

    const events: string[] = [];
    world.onLayerUpdated = (event) => {
      if (event.action === "cloned") {
        events.push(event.metadata.options.name);
      }
    };
    world.cloneLayer("layer");

    assert.deepEqual(events, ["layer (1)"]);
  });

  it("applies the overrides it is handed to the copy", () => {
    const world = new VoxelWorld(8);
    const original = world.addLayer("A");

    const clone = world.cloneLayer("A", { name: "A_1", visible: false });

    assert.ok(clone);
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
    world.setVoxelAt("Source", { x: 1, y: 0, z: 0 }, moved);

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
    world.setVoxelAt("Target", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.setVoxelAt("Source", { x: 0, y: 0, z: 0 }, winner);

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
    world.setVoxelAt("Source", { x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    world.setVoxelAt("Target", { x: 0, y: 0, z: 0 }, winner);

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.deepEqual(
      world.getLayer("Target")?.getVoxelAt({ x: 0, y: 0, z: 0 }),
      winner
    );
  });

  it("resolves overlaps in world space when the layers are offset", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Target");
    world.addLayer("Source");
    world.setLayerOffset("Source", { x: 2, y: 0, z: 0 });
    const entry = makeVoxelEntry(4, 0);
    world.setVoxelAt("Source", { x: 3, y: 0, z: 0 }, entry);

    assert.equal(world.mergeLayer("Source", "Target"), true);

    assert.deepEqual(
      world.getLayer("Target")?.getVoxelAt({ x: 3, y: 0, z: 0 }),
      entry
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
