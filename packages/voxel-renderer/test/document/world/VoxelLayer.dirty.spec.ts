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

describe("VoxelLayer dirtyChunks", () => {
  it("keeps tracking when an external dirty listener subscribes and leaves", () => {
    const layer = makeLayer();
    const chunk = layer.ensureChunk(0, 0, 0);
    const changes: boolean[] = [];
    const unsubscribe = chunk.onDirtyChange((_, dirty) => {
      changes.push(dirty);
    });

    chunk.dirty = false;
    layer.writeVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry(1));

    assert.deepEqual(changes, [true, false, true]);
    assert.deepEqual([...layer.dirtyChunks()], [chunk]);
    unsubscribe();
    chunk.dirty = false;
    layer.writeVoxelAt({ x: 2, y: 0, z: 0 }, makeVoxelEntry(1));
    assert.deepEqual(changes, [true, false, true]);
    assert.deepEqual([...layer.dirtyChunks()], [chunk]);
  });

  it("releases only the layer subscription when a chunk is removed", () => {
    const layer = makeLayer();
    layer.writeVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const chunk = layer.chunkAt(0, 0, 0)!;
    const changes: boolean[] = [];
    chunk.onDirtyChange((_, dirty) => {
      changes.push(dirty);
    });

    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    chunk.dirty = false;
    chunk.dirty = true;

    assert.deepEqual(changes, [true, false, true]);
    assert.deepEqual([...layer.dirtyChunks()], []);
  });

  it("lists a chunk from its first write until it is marked clean", () => {
    const layer = makeLayer();
    layer.writeVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const chunk = layer.chunkAt(0, 0, 0)!;

    assert.deepEqual([...layer.dirtyChunks()], [chunk]);

    chunk.dirty = false;
    assert.deepEqual([...layer.dirtyChunks()], []);

    layer.markChunkDirty(0, 0, 0);
    assert.deepEqual([...layer.dirtyChunks()], [chunk]);
  });

  it("forgets a chunk emptied by a removal", () => {
    const layer = makeLayer();
    layer.writeVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const chunk = layer.chunkAt(0, 0, 0)!;

    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    chunk.dirty = true;

    assert.deepEqual([...layer.dirtyChunks()], []);
  });

  it("tracks exactly the live chunks after a rebase", () => {
    const layer = makeLayer();
    layer.writeVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    layer.writeVoxelAt({ x: 5, y: 0, z: 0 }, makeVoxelEntry(1));
    for (const chunk of layer.chunks()) {
      chunk.dirty = false;
    }

    layer.rebase({ x: 2, y: 0, z: 0 });

    assert.deepEqual(
      new Set(layer.dirtyChunks()),
      new Set(layer.chunks())
    );
  });

  it("gives a clone its own dirty set", () => {
    const layer = makeLayer();
    layer.writeVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1));
    const copy = layer.clone();

    for (const chunk of copy.chunks()) {
      chunk.dirty = false;
    }

    assert.equal([...copy.dirtyChunks()].length, 0);
    assert.equal([...layer.dirtyChunks()].length, 1);
  });
});

describe("VoxelLayer revision", () => {
  it("advances on every write path, even while a chunk stays dirty", () => {
    const layer = makeLayer();
    const writes: Array<() => void> = [
      () => layer.writeVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry(1)),
      () => layer.writeVoxelAt({ x: 2, y: 0, z: 0 }, makeVoxelEntry(1)),
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
