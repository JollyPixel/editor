// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelLayer } from "../../../src/document/world/index.ts";
import { makeVoxelEntry } from "../../helpers/voxelEntry.ts";

function makeLayer(opts?: Partial<ConstructorParameters<typeof VoxelLayer>[0]>) {
  return new VoxelLayer({
    id: "test",
    name: "Test",
    order: 0,
    chunkSize: 4,
    ...opts
  });
}

describe("VoxelLayer getDirtyChunks", () => {
  it("keeps tracking when an external dirty listener subscribes and leaves", () => {
    const layer = makeLayer();
    const chunk = layer.getOrCreateChunk(0, 0, 0);
    const changes: boolean[] = [];
    const unsubscribe = chunk.onDirtyChange((_, dirty) => {
      changes.push(dirty);
    });

    chunk.dirty = false;
    layer.setVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry(1));

    assert.deepEqual(changes, [true, false, true]);
    assert.deepEqual([...layer.getDirtyChunks()], [chunk]);
    unsubscribe();
    chunk.dirty = false;
    layer.setVoxelAt({ x: 2, y: 0, z: 0 }, makeVoxelEntry(1));
    assert.deepEqual(changes, [true, false, true]);
    assert.deepEqual([...layer.getDirtyChunks()], [chunk]);
  });

  it("releases only the layer subscription when a chunk is removed", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const chunk = layer.getChunk(0, 0, 0)!;
    const changes: boolean[] = [];
    chunk.onDirtyChange((_, dirty) => {
      changes.push(dirty);
    });

    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    chunk.dirty = false;
    chunk.dirty = true;

    assert.deepEqual(changes, [true, false, true]);
    assert.deepEqual([...layer.getDirtyChunks()], []);
  });

  it("lists a chunk from its first write until it is marked clean", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const chunk = layer.getChunk(0, 0, 0)!;

    assert.deepEqual([...layer.getDirtyChunks()], [chunk]);

    chunk.dirty = false;
    assert.deepEqual([...layer.getDirtyChunks()], []);

    layer.markChunkDirty(0, 0, 0);
    assert.deepEqual([...layer.getDirtyChunks()], [chunk]);
  });

  it("forgets a chunk emptied by a removal", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const chunk = layer.getChunk(0, 0, 0)!;

    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    chunk.dirty = true;

    assert.deepEqual([...layer.getDirtyChunks()], []);
  });

  it("tracks exactly the live chunks after a rebase", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    layer.setVoxelAt({ x: 5, y: 0, z: 0 }, makeVoxelEntry(1));
    for (const chunk of layer.getChunks()) {
      chunk.dirty = false;
    }

    layer.rebase({ x: 2, y: 0, z: 0 });

    assert.deepEqual(
      new Set(layer.getDirtyChunks()),
      new Set(layer.getChunks())
    );
  });

  it("gives a clone its own dirty set", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const copy = layer.clone();

    for (const chunk of copy.getChunks()) {
      chunk.dirty = false;
    }

    assert.equal([...copy.getDirtyChunks()].length, 0);
    assert.equal([...layer.getDirtyChunks()].length, 1);
  });
});

describe("VoxelLayer revision", () => {
  it("advances on every write path, even while a chunk stays dirty", () => {
    const layer = makeLayer();
    const writes: Array<() => void> = [
      () => layer.setVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry(1)),
      () => layer.setVoxelAt({ x: 2, y: 0, z: 0 }, makeVoxelEntry(1)),
      () => layer.loadPackedVoxels(new Int32Array([3, 0, 0]), [256]),
      () => layer.loadPackedChunk([1, 0, 0], [0], [256]),
      () => layer.removeVoxelAt({ x: 1, y: 0, z: 0 }),
      () => layer.rebase({ x: 2, y: 0, z: 0 })
    ];

    for (const write of writes) {
      const before = layer.revision;
      write();
      assert.ok(layer.revision > before, String(write));
    }
  });
});
