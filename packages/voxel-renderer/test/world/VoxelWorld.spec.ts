// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelWorld } from "../../src/world/VoxelWorld.ts";
import { FACE } from "../../src/utils/math.ts";

function makeEntry(blockId = 1, transform = 0) {
  return { blockId, transform };
}

describe("VoxelWorld addLayer / getLayers / getLayer", () => {
  it("starts with no layers", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.getLayers().length, 0);
  });

  it("addLayer returns a VoxelLayer with the given name", () => {
    const world = new VoxelWorld(4);
    const layer = world.addLayer("Ground");
    assert.equal(layer.name, "Ground");
  });

  it("getLayer finds by name", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    assert.equal(world.getLayer("Ground")?.name, "Ground");
  });

  it("getLayer returns undefined for unknown name", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.getLayer("NoSuchLayer"), undefined);
  });

  it("layers are sorted descending by order", () => {
    const world = new VoxelWorld(4);
    const l0 = world.addLayer("Base");
    const l1 = world.addLayer("Top");
    const layers = world.getLayers();
    // Highest order first
    assert.equal(layers[0], l1);
    assert.equal(layers[1], l0);
  });
});

describe("VoxelWorld removeLayer", () => {
  it("returns true when layer existed", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    assert.equal(world.removeLayer("Ground"), true);
  });

  it("returns false for unknown name", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.removeLayer("NoSuch"), false);
  });

  it("layer is gone after removal", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.removeLayer("Ground");
    assert.equal(world.getLayer("Ground"), undefined);
    assert.equal(world.getLayers().length, 0);
  });
});

describe("VoxelWorld setVoxelAt / removeVoxelAt", () => {
  it("setVoxelAt throws for unknown layer name", () => {
    const world = new VoxelWorld(4);
    assert.throws(
      () => world.setVoxelAt("NoSuch", { x: 0, y: 0, z: 0 }, makeEntry()),
      /layer "NoSuch" does not exist/
    );
  });

  it("setVoxelAt + getVoxelAt round-trip", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const entry = makeEntry(5);
    world.setVoxelAt("Ground", { x: 2, y: 1, z: 3 }, entry);
    assert.equal(world.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);
  });

  it("removeVoxelAt removes the voxel", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeEntry());
    world.removeVoxelAt("Ground", { x: 0, y: 0, z: 0 });
    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
  });

  it("removeVoxelAt for unknown layer does nothing", () => {
    const world = new VoxelWorld(4);
    assert.doesNotThrow(() => world.removeVoxelAt("NoSuch", { x: 0, y: 0, z: 0 }));
  });
});

describe("VoxelWorld getVoxelAt compositing", () => {
  it("returns undefined for empty world", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
  });

  it("higher-order layer wins at the same position", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");
    const baseEntry = makeEntry(1);
    const topEntry = makeEntry(2);
    base.setVoxelAt({ x: 0, y: 0, z: 0 }, baseEntry);
    top.setVoxelAt({ x: 0, y: 0, z: 0 }, topEntry);
    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 }), topEntry);
  });

  it("lower-order layer is returned when higher-order has no voxel there", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    world.addLayer("Top");
    const baseEntry = makeEntry(1);
    base.setVoxelAt({ x: 5, y: 0, z: 0 }, baseEntry);
    assert.equal(world.getVoxelAt({ x: 5, y: 0, z: 0 }), baseEntry);
  });

  it("invisible layer is skipped in compositing", () => {
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");
    const baseEntry = makeEntry(1);
    const topEntry = makeEntry(2);
    base.setVoxelAt({ x: 0, y: 0, z: 0 }, baseEntry);
    top.setVoxelAt({ x: 0, y: 0, z: 0 }, topEntry);
    top.visible = false;
    assert.equal(world.getVoxelAt({ x: 0, y: 0, z: 0 }), baseEntry);
  });
});

describe("VoxelWorld getVoxelNeighbour", () => {
  it("returns the voxel one step in the given face direction", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    const entry = makeEntry(3);
    // Place voxel at (1,0,0) which is the PosX neighbour of (0,0,0)
    world.setVoxelAt("Ground", { x: 1, y: 0, z: 0 }, entry);
    assert.equal(world.getVoxelNeighbour({ x: 0, y: 0, z: 0 }, FACE.PosX), entry);
  });

  it("returns undefined when neighbour position is empty", () => {
    const world = new VoxelWorld(4);
    assert.equal(world.getVoxelNeighbour({ x: 0, y: 0, z: 0 }, FACE.PosX), undefined);
  });
});

describe("VoxelWorld moveLayer", () => {
  // Layers are stored sorted descending by order (highest = index 0).
  // "up" increments the array index → swaps with the element that has a LOWER order value.
  // "down" decrements the array index → swaps with the element that has a HIGHER order value.

  it("moveLayer 'up' on the highest-priority layer swaps it with the next lower-priority one", () => {
    // Sorted state: [Top(idx=0,order=1), Base(idx=1,order=0)]
    // moveLayer("Top","up"): idx=0, swapIdx=1 → swap orders
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");
    world.moveLayer("Top", "up");
    assert.equal(top.order, 0);
    assert.equal(base.order, 1);
  });

  it("moveLayer 'down' on the lowest-priority layer swaps it with the next higher-priority one", () => {
    // Sorted state: [Top(idx=0,order=1), Base(idx=1,order=0)]
    // moveLayer("Base","down"): idx=1, swapIdx=0 → swap orders
    const world = new VoxelWorld(4);
    const base = world.addLayer("Base");
    const top = world.addLayer("Top");
    world.moveLayer("Base", "down");
    assert.equal(base.order, 1);
    assert.equal(top.order, 0);
  });

  it("does nothing for unknown layer name", () => {
    const world = new VoxelWorld(4);
    assert.doesNotThrow(() => world.moveLayer("NoSuch", "up"));
  });

  it("does nothing when layer is already at the top", () => {
    const world = new VoxelWorld(4);
    const only = world.addLayer("Only");
    const orderBefore = only.order;
    world.moveLayer("Only", "up");
    assert.equal(only.order, orderBefore);
  });
});

describe("VoxelWorld setLayerVisible", () => {
  it("sets layer.visible", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setLayerVisible("Ground", false);
    assert.equal(world.getLayer("Ground")!.visible, false);
  });
});

describe("VoxelWorld setLayerOffset / translateLayer", () => {
  it("setLayerOffset updates layer.offset", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setLayerOffset("Ground", { x: 16, y: 0, z: -8 });
    assert.deepEqual(world.getLayer("Ground")!.offset, { x: 16, y: 0, z: -8 });
  });

  it("setLayerOffset marks all chunks dirty", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeEntry());
    const chunk = world.getLayer("Ground")!.getChunk(0, 0, 0)!;
    chunk.dirty = false;
    world.setLayerOffset("Ground", { x: 4, y: 0, z: 0 });
    assert.equal(chunk.dirty, true);
  });

  it("translateLayer accumulates offset", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setLayerOffset("Ground", { x: 4, y: 0, z: 0 });
    world.translateLayer("Ground", { x: 4, y: 0, z: 2 });
    assert.deepEqual(world.getLayer("Ground")!.offset, { x: 8, y: 0, z: 2 });
  });
});

describe("VoxelWorld getAllDirtyChunks / getAllChunks", () => {
  it("getAllDirtyChunks yields chunks with dirty=true", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeEntry());
    const dirty = [...world.getAllDirtyChunks()];
    assert.equal(dirty.length, 1);
    assert.equal(dirty[0].chunk.dirty, true);
  });

  it("chunk cleared of dirty is not yielded", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeEntry());
    world.getLayer("Ground")!.getChunk(0, 0, 0)!.dirty = false;
    const dirty = [...world.getAllDirtyChunks()];
    assert.equal(dirty.length, 0);
  });

  it("getAllChunks yields all chunks regardless of dirty flag", () => {
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    world.addLayer("Deco");
    world.setVoxelAt("Ground", { x: 0, y: 0, z: 0 }, makeEntry());
    world.setVoxelAt("Deco", { x: 0, y: 0, z: 0 }, makeEntry());
    // Clear dirty
    for (const { chunk } of world.getAllChunks()) {
      chunk.dirty = false;
    }
    const all = [...world.getAllChunks()];
    assert.equal(all.length, 2);
  });
});

describe("VoxelWorld markNeighbourChunksDirty (via setVoxelAt)", () => {
  it("setting a voxel at chunk boundary marks the adjacent chunk dirty", () => {
    // Use chunkSize=4; a voxel at x=3 (last column) should dirty the chunk at cx+1
    const world = new VoxelWorld(4);
    world.addLayer("Ground");
    // First create the adjacent chunk
    world.getLayer("Ground")!.getOrCreateChunk(1, 0, 0).dirty = false;
    // Now place a voxel at the right boundary of chunk 0
    world.setVoxelAt("Ground", { x: 3, y: 0, z: 0 }, makeEntry());
    const adjChunk = world.getLayer("Ground")!.getChunk(1, 0, 0);
    assert.ok(adjChunk !== undefined);
    assert.equal(adjChunk.dirty, true);
  });
});

describe("VoxelWorld clear", () => {
  it("removes all layers", () => {
    const world = new VoxelWorld(4);
    world.addLayer("A");
    world.addLayer("B");
    world.clear();
    assert.equal(world.getLayers().length, 0);
  });
});

describe("VoxelWorld chunkSize", () => {
  it("defaults to DEFAULT_CHUNK_SIZE (16)", () => {
    const world = new VoxelWorld();
    assert.equal(world.chunkSize, 16);
  });

  it("respects custom chunkSize", () => {
    const world = new VoxelWorld(8);
    assert.equal(world.chunkSize, 8);
  });
});
