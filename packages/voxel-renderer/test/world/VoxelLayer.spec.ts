// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelLayer } from "../../src/world/VoxelLayer.ts";

function makeEntry(blockId = 1, transform = 0) {
  return { blockId, transform };
}

function makeLayer(opts?: Partial<ConstructorParameters<typeof VoxelLayer>[0]>) {
  return new VoxelLayer({
    id: "test",
    name: "Test",
    order: 0,
    chunkSize: 4,
    ...opts
  });
}

describe("VoxelLayer constructor", () => {
  it("sets id, name, order from options", () => {
    const layer = makeLayer({ id: "l1", name: "Ground", order: 2 });
    assert.equal(layer.id, "l1");
    assert.equal(layer.name, "Ground");
    assert.equal(layer.order, 2);
  });

  it("defaults visible to true", () => {
    assert.equal(makeLayer().visible, true);
  });

  it("respects explicit visible=false", () => {
    assert.equal(makeLayer({ visible: false }).visible, false);
  });

  it("defaults offset to {x:0,y:0,z:0}", () => {
    assert.deepEqual(makeLayer().offset, { x: 0, y: 0, z: 0 });
  });

  it("respects explicit offset", () => {
    const layer = makeLayer({ offset: { x: 16, y: 0, z: -8 } });
    assert.deepEqual(layer.offset, { x: 16, y: 0, z: -8 });
  });

  it("starts with chunkCount 0", () => {
    assert.equal(makeLayer().chunkCount, 0);
  });
});

describe("setVoxelAt / getVoxelAt round-trip", () => {
  it("retrieves the entry at the same position", () => {
    const layer = makeLayer();
    const entry = makeEntry(7, 3);
    layer.setVoxelAt({ x: 2, y: 1, z: 3 }, entry);
    assert.equal(layer.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);
  });

  it("returns undefined for positions not set", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    assert.equal(layer.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
  });

  it("creates one chunk when first voxel is set in it", () => {
    const layer = makeLayer();
    assert.equal(layer.chunkCount, 0);
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    assert.equal(layer.chunkCount, 1);
  });

  it("creates a second chunk for a voxel in a different chunk", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    // cx=1
    layer.setVoxelAt({ x: 4, y: 0, z: 0 }, makeEntry());
    assert.equal(layer.chunkCount, 2);
  });
});

describe("negative coordinates", () => {
  it("setVoxelAt / getVoxelAt work for negative positions", () => {
    const layer = makeLayer();
    const entry = makeEntry(3);
    layer.setVoxelAt({ x: -1, y: 0, z: -1 }, entry);
    assert.equal(layer.getVoxelAt({ x: -1, y: 0, z: -1 }), entry);
  });

  it("negative x=-1 lands in chunk cx=-1", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: -1, y: 0, z: 0 }, makeEntry());
    // Chunk cx for x=-1 is floor(-1/4) = -1
    const chunk = layer.getChunk(-1, 0, 0);
    assert.ok(chunk !== undefined, "chunk at cx=-1 should exist");
    assert.equal(chunk.voxelCount, 1);
  });

  it("does not conflate x=-1 with x=3 in a size-4 chunk", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const entryNeg = makeEntry(1);
    const entryPos = makeEntry(2);
    layer.setVoxelAt({ x: -1, y: 0, z: 0 }, entryNeg);
    layer.setVoxelAt({ x: 3, y: 0, z: 0 }, entryPos);
    assert.equal(layer.getVoxelAt({ x: -1, y: 0, z: 0 }), entryNeg);
    assert.equal(layer.getVoxelAt({ x: 3, y: 0, z: 0 }), entryPos);
  });
});

describe("offset arithmetic", () => {
  it("with offset {x:8}, world pos {x:8,y:0,z:0} lands in chunk 0 of the layer", () => {
    const layer = makeLayer({ chunkSize: 4, offset: { x: 8, y: 0, z: 0 } });
    const entry = makeEntry();
    layer.setVoxelAt({ x: 8, y: 0, z: 0 }, entry);
    // local x = 8-8 = 0 → cx=0
    const chunk = layer.getChunk(0, 0, 0);
    assert.ok(chunk !== undefined);
    assert.equal(layer.getVoxelAt({ x: 8, y: 0, z: 0 }), entry);
  });

  it("offset shifts all accesses by the same amount", () => {
    const layer = makeLayer({ chunkSize: 16, offset: { x: 100, y: 0, z: 0 } });
    const entry = makeEntry(42);
    layer.setVoxelAt({ x: 100, y: 0, z: 0 }, entry);
    assert.equal(layer.getVoxelAt({ x: 100, y: 0, z: 0 }), entry);
    assert.equal(layer.getVoxelAt({ x: 99, y: 0, z: 0 }), undefined);
  });
});

describe("removeVoxelAt", () => {
  it("removes an existing voxel", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
  });

  it("does nothing for a position that was never set", () => {
    const layer = makeLayer();
    assert.doesNotThrow(() => layer.removeVoxelAt({ x: 99, y: 0, z: 0 }));
  });

  it("deletes the chunk when it becomes empty", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    assert.equal(layer.chunkCount, 1);
    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    assert.equal(layer.chunkCount, 0);
  });

  it("does not delete the chunk when another voxel remains", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    layer.setVoxelAt({ x: 1, y: 0, z: 0 }, makeEntry());
    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    assert.equal(layer.chunkCount, 1);
  });
});

describe("getOrCreateChunk", () => {
  it("creates a new chunk on first call", () => {
    const layer = makeLayer();
    const chunk = layer.getOrCreateChunk(2, 3, 4);
    assert.equal(chunk.cx, 2);
    assert.equal(chunk.cy, 3);
    assert.equal(chunk.cz, 4);
  });

  it("returns the same instance on subsequent calls", () => {
    const layer = makeLayer();
    const c1 = layer.getOrCreateChunk(0, 0, 0);
    const c2 = layer.getOrCreateChunk(0, 0, 0);
    assert.equal(c1, c2);
  });
});

describe("markChunkDirty", () => {
  it("sets dirty=true on an existing chunk", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    const chunk = layer.getChunk(0, 0, 0)!;
    chunk.dirty = false;
    layer.markChunkDirty(0, 0, 0);
    assert.equal(chunk.dirty, true);
  });

  it("does nothing for a non-existent chunk (no throw)", () => {
    const layer = makeLayer();
    assert.doesNotThrow(() => layer.markChunkDirty(99, 0, 0));
  });
});

describe("getChunks", () => {
  it("yields all live chunks", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeEntry());
    layer.setVoxelAt({ x: 4, y: 0, z: 0 }, makeEntry());
    const chunks = [...layer.getChunks()];
    assert.equal(chunks.length, 2);
  });
});
