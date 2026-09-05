// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";
import {
  clearAllDirty,
  dirtyFlags,
  makeTwoLayerWorld
} from "../helpers/world.ts";

describe("VoxelWorld — layer properties", () => {
  it("updates only the properties it is given", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground", { opacity: 0.7 });

    assert.equal(world.updateLayer("Ground", { visible: false }), true);
    assert.equal(layer.opacity, 0.7);
    assert.equal(layer.visible, false);

    world.updateLayer("Ground", { opacity: 0.5 });
    assert.equal(layer.opacity, 0.5);
  });

  it("carries visibility, opacity and offset through the dedicated setters", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");

    world.setLayerVisible("Ground", false);
    world.setLayerOpacity("Ground", 0.5);
    world.setLayerOffset("Ground", { x: 16, y: 0, z: -8 });

    assert.equal(layer.visible, false);
    assert.equal(layer.opacity, 0.5);
    assert.deepEqual(layer.offset, { x: 16, y: 0, z: -8 });
  });

  it("accumulates an offset through translateLayer", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");

    world.setLayerOffset("Ground", { x: 4, y: 0, z: 0 });
    world.translateLayer("Ground", { x: 4, y: 0, z: 2 });

    assert.deepEqual(layer.offset, { x: 8, y: 0, z: 2 });
  });

  it("shrugs off an unknown layer name", () => {
    const world = new VoxelWorld(4);

    assert.equal(world.updateLayer("NoSuch", { opacity: 0.5 }), false);
    assert.doesNotThrow(() => world.setLayerOpacity("NoSuch", 0.5));
  });
});

/**
 * A change that alters what one layer occludes has to remesh every layer, not
 * just its own: a neighbour's culled faces were decided against the old state.
 */
describe("VoxelWorld — dirty propagation", () => {
  it("dirties an adjacent chunk when a voxel lands on the boundary", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");
    layer.getOrCreateChunk(1, 0, 0).dirty = false;

    world.setVoxelAt("Ground", { x: 3, y: 0, z: 0 }, makeVoxelEntry());

    assert.equal(layer.getChunk(1, 0, 0)?.dirty, true);
  });

  it("dirties every layer when one is removed", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.removeLayer("A");

    assert.equal(dirtyFlags(fixture).b, true);
  });

  it("dirties every layer when visibility actually flips", () => {
    for (const flip of [
      (world: VoxelWorld) => world.setLayerVisible("A", false),
      (world: VoxelWorld) => world.updateLayer("A", { visible: false })
    ]) {
      const fixture = makeTwoLayerWorld();
      clearAllDirty(fixture.world);

      flip(fixture.world);

      assert.deepEqual(dirtyFlags(fixture), { a: true, b: true });
    }
  });

  it("dirties only the layer itself when visibility is set to what it already was", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.setLayerVisible("A", true);

    assert.deepEqual(dirtyFlags(fixture), { a: true, b: false });
  });

  it("dirties every layer when opacity crosses the occlusion boundary", () => {
    for (const [from, to] of [[1, 0.9], [0.5, 1]]) {
      const fixture = makeTwoLayerWorld();
      fixture.a.opacity = from;
      clearAllDirty(fixture.world);

      fixture.world.setLayerOpacity("A", to);

      assert.deepEqual(
        dirtyFlags(fixture),
        { a: true, b: true },
        `opacity ${from} -> ${to} changes what layer A occludes`
      );
    }
  });

  it("dirties only the layer itself when opacity stays translucent", () => {
    const fixture = makeTwoLayerWorld();
    fixture.a.opacity = 0.5;
    clearAllDirty(fixture.world);

    fixture.world.setLayerOpacity("A", 0.8);

    assert.deepEqual(dirtyFlags(fixture), { a: true, b: false });
  });

  it("dirties the layer's own chunks when it moves", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.setLayerOffset("A", { x: 4, y: 0, z: 0 });

    assert.equal(dirtyFlags(fixture).a, true);
  });
});

describe("VoxelWorld — chunk enumeration", () => {
  it("yields every chunk, and separately only the dirty ones", () => {
    const fixture = makeTwoLayerWorld();

    assert.equal([...fixture.world.getAllChunks()].length, 2);
    assert.equal([...fixture.world.getAllDirtyChunks()].length, 2);

    clearAllDirty(fixture.world);

    assert.equal([...fixture.world.getAllChunks()].length, 2);
    assert.deepEqual([...fixture.world.getAllDirtyChunks()], []);
  });
});
