// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../../src/document/world/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";
import {
  clearAllDirty,
  dirtyFlags,
  eraseVoxel,
  makeTwoLayerWorld,
  writeVoxel
} from "../../helpers/world.ts";

describe("VoxelWorld — layer properties", () => {
  it("updates only the properties it is given", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground", { compositing: "replace" });

    assert.equal(world.updateLayer("Ground", { visible: false }), true);
    assert.equal(layer.compositing, "replace");
    assert.equal(layer.visible, false);
  });

  it("carries the position through the dedicated setter", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");

    world.setLayerPosition("Ground", { x: 16, y: 0, z: -8 });

    assert.deepEqual(layer.position, { x: 16, y: 0, z: -8 });
  });

  it("shrugs off an unknown layer name", () => {
    const world = new VoxelWorld(4);

    assert.equal(world.updateLayer("NoSuch", { visible: false }), false);
  });
});

describe("VoxelWorld — dirty propagation", () => {
  it("dirties an adjacent chunk when a voxel lands on the boundary", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");
    layer.getOrCreateChunk(1, 0, 0).dirty = false;

    writeVoxel(world, "Ground", { x: 3, y: 0, z: 0 }, makeVoxelEntry());

    assert.equal(layer.getChunk(1, 0, 0)?.dirty, true);
  });

  it("dirties the edge and corner chunks of a voxel on a chunk corner", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");
    const corner = layer.getOrCreateChunk(1, 1, 1);
    const edge = layer.getOrCreateChunk(1, 1, 0);
    const beyond = layer.getOrCreateChunk(2, 1, 1);
    for (const chunk of [corner, edge, beyond]) {
      chunk.dirty = false;
    }

    writeVoxel(world, "Ground", { x: 3, y: 3, z: 3 }, makeVoxelEntry());

    assert.equal(corner.dirty, true);
    assert.equal(edge.dirty, true);
    assert.equal(beyond.dirty, false);
  });

  it("dirties every layer when one is removed", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.removeLayer("A");

    assert.equal(dirtyFlags(fixture).b, true);
  });

  it("dirties every layer when one is cloned over them", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.cloneLayer("A");

    assert.deepEqual(dirtyFlags(fixture), { a: true, b: true });
  });

  it("dirties every layer when visibility actually flips", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.updateLayer("A", { visible: false });

    assert.deepEqual(dirtyFlags(fixture), { a: true, b: true });
  });

  it("dirties only the layer itself when visibility is set to what it already was", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.updateLayer("A", { visible: true });

    assert.deepEqual(dirtyFlags(fixture), { a: true, b: false });
  });

  it("dirties the layer's own chunks when it moves", () => {
    const fixture = makeTwoLayerWorld();
    clearAllDirty(fixture.world);

    fixture.world.setLayerPosition("A", { x: 4, y: 0, z: 0 });

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

describe("VoxelWorld — cross-layer dirty propagation", () => {
  it("dirties the other layers' chunk holding the edited cell", () => {
    const world = new VoxelWorld(4);
    const upper = world.addLayer("Upper");
    const lower = world.addLayer("Lower");
    writeVoxel(world, "Lower", { x: 1, y: 1, z: 1 }, makeVoxelEntry());
    lower.getChunk(0, 0, 0)!.dirty = false;

    writeVoxel(world, "Upper", { x: 1, y: 1, z: 1 }, makeVoxelEntry());

    assert.equal(lower.getChunk(0, 0, 0)?.dirty, true);
    assert.equal(upper.getChunk(0, 0, 0)?.dirty, true);
  });

  it("dirties the other layers' neighbour chunk across a boundary", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Upper");
    const lower = world.addLayer("Lower");
    writeVoxel(world, "Lower", { x: 4, y: 0, z: 0 }, makeVoxelEntry());
    lower.getChunk(1, 0, 0)!.dirty = false;

    writeVoxel(world, "Upper", { x: 3, y: 0, z: 0 }, makeVoxelEntry());

    assert.equal(lower.getChunk(1, 0, 0)?.dirty, true);
  });

  it("dirties the other layers on removal too", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Upper");
    const lower = world.addLayer("Lower");
    writeVoxel(world, "Upper", { x: 1, y: 1, z: 1 }, makeVoxelEntry());
    writeVoxel(world, "Lower", { x: 1, y: 1, z: 1 }, makeVoxelEntry());
    lower.getChunk(0, 0, 0)!.dirty = false;

    eraseVoxel(world, "Upper", { x: 1, y: 1, z: 1 });

    assert.equal(lower.getChunk(0, 0, 0)?.dirty, true);
  });

  it("maps the cell through a layer's own position", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Upper");
    const lower = world.addLayer("Lower");
    lower.position = { x: 4, y: 0, z: 0 };
    writeVoxel(world, "Lower", { x: 5, y: 1, z: 1 }, makeVoxelEntry());
    lower.getChunk(0, 0, 0)!.dirty = false;

    writeVoxel(world, "Upper", { x: 5, y: 1, z: 1 }, makeVoxelEntry());

    assert.equal(lower.getChunk(0, 0, 0)?.dirty, true);
  });
});
