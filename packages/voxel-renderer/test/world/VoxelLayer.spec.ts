// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelLayer } from "../../src/world/index.ts";
import { AIR_BLOCK_ID } from "../../src/blocks/index.ts";
import { makeVoxelEntry } from "../helpers/voxelEntry.ts";

// CONSTANTS
const kOutOfRangeCoord = 1 << 20;

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
  it("sets id, name and order from options", () => {
    const layer = makeLayer({ id: "l1", name: "Ground", order: 2 });

    assert.equal(layer.id, "l1");
    assert.equal(layer.name, "Ground");
    assert.equal(layer.order, 2);
  });

  it("defaults to a visible, opaque, empty layer at the origin", () => {
    const layer = makeLayer();

    assert.equal(layer.visible, true);
    assert.equal(layer.opacity, 1);
    assert.deepEqual(layer.position, { x: 0, y: 0, z: 0 });
    assert.equal(layer.chunkCount, 0);
  });

  it("respects explicit options", () => {
    const layer = makeLayer({ visible: false, opacity: 0.5, position: { x: 16, y: 0, z: -8 } });

    assert.equal(layer.visible, false);
    assert.equal(layer.opacity, 0.5);
    assert.deepEqual(layer.position, { x: 16, y: 0, z: -8 });
  });
});

describe("VoxelLayer opacity", () => {
  for (const [requested, expected] of [[5, 1], [-5, 0]]) {
    it(`clamps ${requested} to ${expected} in the constructor and the setter`, () => {
      const layer = makeLayer();
      layer.opacity = requested;

      assert.equal(layer.opacity, expected);
      assert.equal(makeLayer({ opacity: requested }).opacity, expected);
    });
  }

  it("wasVisible flips true when opacity drops to 0 while visible", () => {
    const layer = makeLayer();
    assert.equal(layer.wasVisible, false);
    layer.opacity = 0;
    assert.equal(layer.wasVisible, true);
  });

  it("wasVisible flips back false when opacity rises above 0 again", () => {
    const layer = makeLayer();
    layer.opacity = 0;
    assert.equal(layer.wasVisible, true);
    layer.opacity = 1;
    assert.equal(layer.wasVisible, false);
  });

  it("wasVisible is unaffected by opacity changes that stay above 0", () => {
    const layer = makeLayer();
    layer.opacity = 0.5;
    assert.equal(layer.wasVisible, false);
    layer.opacity = 0.8;
    assert.equal(layer.wasVisible, false);
  });

  it("wasVisible does not flip again when opacity is already 0 and visible is toggled off too", () => {
    const layer = makeLayer();
    layer.opacity = 0;
    assert.equal(layer.wasVisible, true);
    layer.visible = false;
    assert.equal(layer.wasVisible, true);
  });

  it("keeps wasVisible false when a layer that was never visible is hidden", () => {
    const layer = makeLayer({ opacity: 0 });
    assert.equal(layer.wasVisible, false);
    layer.visible = false;
    assert.equal(layer.wasVisible, false);
  });
});

describe("VoxelLayer setVoxelAt / getVoxelAt round-trip", () => {
  it("retrieves the entry at the same position", () => {
    const layer = makeLayer();
    const entry = makeVoxelEntry(7, 3);
    layer.setVoxelAt({ x: 2, y: 1, z: 3 }, entry);
    assert.deepEqual(layer.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);
  });

  it("returns undefined for positions not set", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    assert.equal(layer.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
  });

  it("rejects air instead of storing it as a voxel", () => {
    const layer = makeLayer();

    assert.throws(
      () => layer.setVoxelAt(
        { x: 0, y: 0, z: 0 },
        makeVoxelEntry(AIR_BLOCK_ID)
      ),
      /reserved for air/
    );
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(layer.chunkCount, 0);
  });

  it("creates one chunk when first voxel is set in it", () => {
    const layer = makeLayer();
    assert.equal(layer.chunkCount, 0);
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    assert.equal(layer.chunkCount, 1);
  });

  it("creates a second chunk for a voxel in a different chunk", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    layer.setVoxelAt({ x: 4, y: 0, z: 0 }, makeVoxelEntry());
    assert.equal(layer.chunkCount, 2);
  });
});

describe("VoxelLayer negative coordinates", () => {
  it("setVoxelAt / getVoxelAt work for negative positions", () => {
    const layer = makeLayer();
    const entry = makeVoxelEntry(3);
    layer.setVoxelAt({ x: -1, y: 0, z: -1 }, entry);
    assert.deepEqual(layer.getVoxelAt({ x: -1, y: 0, z: -1 }), entry);
  });

  it("negative x=-1 lands in chunk cx=-1", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: -1, y: 0, z: 0 }, makeVoxelEntry());
    const chunk = layer.getChunk(-1, 0, 0);
    assert.ok(chunk !== undefined, "chunk at cx=-1 should exist");
    assert.equal(chunk.voxelCount, 1);
  });

  it("does not conflate x=-1 with x=3 in a size-4 chunk", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const entryNeg = makeVoxelEntry(1);
    const entryPos = makeVoxelEntry(2);
    layer.setVoxelAt({ x: -1, y: 0, z: 0 }, entryNeg);
    layer.setVoxelAt({ x: 3, y: 0, z: 0 }, entryPos);
    assert.deepEqual(layer.getVoxelAt({ x: -1, y: 0, z: 0 }), entryNeg);
    assert.deepEqual(layer.getVoxelAt({ x: 3, y: 0, z: 0 }), entryPos);
  });
});

describe("VoxelLayer position arithmetic", () => {
  it("position shifts all accesses by the same amount", () => {
    const layer = makeLayer({ chunkSize: 16, position: { x: 100, y: 0, z: 0 } });
    const entry = makeVoxelEntry(42);
    layer.setVoxelAt({ x: 100, y: 0, z: 0 }, entry);
    assert.deepEqual(layer.getVoxelAt({ x: 100, y: 0, z: 0 }), entry);
    assert.equal(layer.getVoxelAt({ x: 99, y: 0, z: 0 }), undefined);
  });
});

describe("VoxelLayer coordinates and bounds", () => {
  it("converts between local and world coordinates", () => {
    const layer = makeLayer({ position: { x: 10, y: 2, z: -3 } });

    assert.deepEqual(
      layer.localToWorld({ x: 4, y: -1, z: 8 }).toArray(),
      [14, 1, 5]
    );
    assert.deepEqual(
      layer.worldToLocal({ x: 14, y: 1, z: 5 }).toArray(),
      [4, -1, 8]
    );
  });

  it("reports local and world voxel bounds", () => {
    const layer = makeLayer({ position: { x: 10, y: 2, z: -3 } });
    layer.setVoxelAt({ x: 8, y: 2, z: -4 }, makeVoxelEntry());
    layer.setVoxelAt({ x: 12, y: 3, z: -3 }, makeVoxelEntry());

    const local = layer.localBounds();
    const world = layer.worldBounds();
    assert.ok(local !== null);
    assert.ok(world !== null);
    assert.deepEqual(local.min.toArray(), [-2, 0, -1]);
    assert.deepEqual(local.max.toArray(), [3, 2, 1]);
    assert.deepEqual(world.min.toArray(), [8, 2, -4]);
    assert.deepEqual(world.max.toArray(), [13, 4, -2]);
    assert.deepEqual(layer.worldCenter().toArray(), [10.5, 3, -3]);
  });

  it("uses the layer position as the center of an empty layer", () => {
    const layer = makeLayer({ position: { x: 10, y: 2, z: -3 } });

    assert.equal(layer.localBounds(), null);
    assert.equal(layer.worldBounds(), null);
    assert.deepEqual(layer.worldCenter().toArray(), [10, 2, -3]);
  });

  it("rebases local storage without moving voxels in world space", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 10, y: 2, z: -3 }, makeVoxelEntry(1));
    layer.setVoxelAt({ x: 12, y: 2, z: -3 }, makeVoxelEntry(2));

    layer.rebase({ x: 10, y: 2, z: -3 });

    assert.deepEqual(layer.position, { x: 10, y: 2, z: -3 });
    assert.equal(layer.getVoxelAt({ x: 10, y: 2, z: -3 })?.blockId, 1);
    assert.equal(layer.getVoxelAt({ x: 12, y: 2, z: -3 })?.blockId, 2);
    assert.deepEqual(Object.keys(layer.toJSON().voxels).sort(), [
      "0,0,0",
      "2,0,0"
    ]);
  });

  it("changes nothing when rebased onto its own position", () => {
    const layer = makeLayer({ position: { x: 4, y: 0, z: 0 } });
    layer.setVoxelAt({ x: 4, y: 0, z: 0 }, makeVoxelEntry());
    const chunk = layer.getChunk(0, 0, 0)!;
    chunk.dirty = false;

    layer.rebase({ x: 4, y: 0, z: 0 });

    assert.equal(layer.getChunk(0, 0, 0), chunk);
    assert.equal(chunk.dirty, false);
  });

  it("keeps a chunk instance when rebasing leaves its coordinates unchanged", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 2, y: 0, z: 0 }, makeVoxelEntry());
    const chunk = layer.getChunk(0, 0, 0);

    layer.rebase({ x: 1, y: 0, z: 0 });

    assert.equal(layer.getChunk(0, 0, 0), chunk);
  });

  it("retires a chunk when rebasing moves its contents to another chunk", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    const previous = layer.getChunk(0, 0, 0);

    layer.rebase({ x: 4, y: 0, z: 0 });

    assert.equal(layer.getChunk(0, 0, 0), undefined);
    assert.notEqual(layer.getChunk(-1, 0, 0), previous);
    assert.deepEqual([...layer.drainPendingRemovals()], [previous]);
    assert.deepEqual(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), makeVoxelEntry());
  });
});

describe("VoxelLayer removeVoxelAt", () => {
  it("removes an existing voxel", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
  });

  it("does nothing for a position that was never set", () => {
    const layer = makeLayer();
    assert.doesNotThrow(() => layer.removeVoxelAt({ x: 99, y: 0, z: 0 }));
  });

  it("deletes the chunk when it becomes empty", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    assert.equal(layer.chunkCount, 1);
    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    assert.equal(layer.chunkCount, 0);
  });

  it("does not delete the chunk when another voxel remains", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    layer.setVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry());
    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
    assert.equal(layer.chunkCount, 1);
  });
});

describe("VoxelLayer getOrCreateChunk", () => {
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

describe("VoxelLayer markChunkDirty", () => {
  it("sets dirty=true on an existing chunk", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    const chunk = layer.getChunk(0, 0, 0);
    assert.ok(chunk !== undefined);
    chunk.dirty = false;
    layer.markChunkDirty(0, 0, 0);
    assert.equal(chunk.dirty, true);
  });

  it("does nothing for a non-existent chunk (no throw)", () => {
    const layer = makeLayer();
    assert.doesNotThrow(() => layer.markChunkDirty(99, 0, 0));
  });
});

describe("VoxelLayer getChunks", () => {
  it("yields all live chunks", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    layer.setVoxelAt({ x: 4, y: 0, z: 0 }, makeVoxelEntry());
    const chunks = [...layer.getChunks()];
    assert.equal(chunks.length, 2);
  });
});

describe("VoxelLayer clone", () => {
  it("clones a layer", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const clone = layer.clone();
    assert.deepEqual(clone.toJSON(), layer.toJSON());
    assert.notEqual(clone, layer);
  });

  it("applies overrides on the fly", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const clone = layer.clone({ visible: false, name: "Cloned" });
    assert.deepEqual(clone.toJSON(), {
      ...layer.toJSON(), visible: false, name: "Cloned"
    });
  });

  it("carries the voxels over", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const entry = makeVoxelEntry(6, 1);
    layer.setVoxelAt({ x: 1, y: 2, z: 3 }, entry);
    layer.setVoxelAt({ x: 9, y: 0, z: 0 }, makeVoxelEntry(2, 0));

    const clone = layer.clone();

    assert.equal(clone.chunkCount, layer.chunkCount);
    assert.deepEqual(clone.getVoxelAt({ x: 1, y: 2, z: 3 }), entry);
    assert.deepEqual(clone.toJSON().voxels, layer.toJSON().voxels);
  });

  it("shares no voxel storage with the source", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));

    const clone = layer.clone();
    clone.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(5, 0));
    clone.removeVoxelAt({ x: 0, y: 0, z: 0 });
    clone.setVoxelAt({ x: 20, y: 0, z: 0 }, makeVoxelEntry(3, 0));

    assert.deepEqual(
      layer.getVoxelAt({ x: 0, y: 0, z: 0 }),
      makeVoxelEntry(1, 0)
    );
    assert.equal(layer.getVoxelAt({ x: 20, y: 0, z: 0 }), undefined);
  });

  it("keeps the source chunk size whatever the overrides ask for", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 5, y: 0, z: 0 }, makeVoxelEntry());

    const clone = layer.clone({ chunkSize: 16 });

    assert.deepEqual(
      clone.getVoxelAt({ x: 5, y: 0, z: 0 }),
      makeVoxelEntry()
    );
  });

  it("copies position and properties rather than sharing them", () => {
    const layer = makeLayer({
      chunkSize: 4,
      position: { x: 1, y: 2, z: 3 },
      properties: { biome: "forest" }
    });

    const clone = layer.clone();
    clone.position.x = 99;
    clone.properties.biome = "desert";

    assert.deepEqual(layer.position, { x: 1, y: 2, z: 3 });
    assert.deepEqual(layer.properties, { biome: "forest" });
  });
});

describe("VoxelLayer mergeFrom overwrite", () => {
  it("replaces overlapping voxels by default", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    target.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    source.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(9, 0));

    target.mergeFrom(source);

    assert.deepEqual(
      target.getVoxelAt({ x: 0, y: 0, z: 0 }),
      makeVoxelEntry(9, 0)
    );
  });

  it("keeps the target's voxels when overwrite is off", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    target.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(1, 0));
    source.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(9, 0));
    source.setVoxelAt({ x: 1, y: 0, z: 0 }, makeVoxelEntry(8, 0));

    target.mergeFrom(source, { overwrite: false });

    assert.deepEqual(
      target.getVoxelAt({ x: 0, y: 0, z: 0 }),
      makeVoxelEntry(1, 0)
    );
    assert.deepEqual(
      target.getVoxelAt({ x: 1, y: 0, z: 0 }),
      makeVoxelEntry(8, 0)
    );
  });
});

describe("VoxelLayer mergeFrom", () => {
  it("copies voxels at correct world positions (both layers at position {0,0,0})", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const entry = makeVoxelEntry(5, 2);
    source.setVoxelAt({ x: 2, y: 1, z: 3 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);
  });

  it(
    "applies source position: voxel at local (1,0,0) with source position {5,0,0} lands at world (6,0,0)",
    () => {
      const source = makeLayer({ id: "src", name: "Source", position: { x: 5, y: 0, z: 0 } });
      const target = makeLayer({ id: "tgt", name: "Target" });
      const entry = makeVoxelEntry(3, 0);
      source.setVoxelAt({ x: 6, y: 0, z: 0 }, entry);

      target.mergeFrom(source);

      assert.deepEqual(target.getVoxelAt({ x: 6, y: 0, z: 0 }), entry);
      assert.equal(target.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
    }
  );

  it("applies target position: target with position {3,0,0} stores world (6,0,0) at local (3,0,0)", () => {
    const source = makeLayer({ id: "src", name: "Source", position: { x: 5, y: 0, z: 0 } });
    const target = makeLayer({ id: "tgt", name: "Target", position: { x: 3, y: 0, z: 0 } });
    const entry = makeVoxelEntry(7, 1);
    source.setVoxelAt({ x: 6, y: 0, z: 0 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 6, y: 0, z: 0 }), entry);
  });

  it("source layer is not modified after merge", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const entry = makeVoxelEntry(2, 0);
    source.setVoxelAt({ x: 1, y: 1, z: 1 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(source.getVoxelAt({ x: 1, y: 1, z: 1 }), entry);
    assert.equal(source.chunkCount, 1);
  });
});

describe("VoxelLayer chunk keys", () => {
  it("rejects a non power-of-two chunkSize", () => {
    assert.throws(
      () => makeLayer({ chunkSize: 12 }),
      /chunkSize must be a power of two, received 12/
    );
  });

  it("does not alias two chunks onto one key", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const chunks = new Set();

    for (const cx of [-3, 0, 5]) {
      for (const cy of [-2, 0, 7]) {
        for (const cz of [-1, 0, 9]) {
          const chunk = layer.getOrCreateChunk(cx, cy, cz);
          assert.deepEqual([chunk.cx, chunk.cy, chunk.cz], [cx, cy, cz]);
          chunks.add(chunk);
        }
      }
    }

    assert.equal(chunks.size, 27);
    assert.equal(layer.chunkCount, 27);
  });

  it("throws rather than aliasing a chunk beyond the packable range", () => {
    const layer = makeLayer({ chunkSize: 4 });

    assert.throws(() => layer.getOrCreateChunk(kOutOfRangeCoord, 0, 0), RangeError);
    assert.throws(() => layer.getOrCreateChunk(0, kOutOfRangeCoord, 0), RangeError);
  });

  it("forgets the memoized chunk once it is dropped", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    assert.ok(layer.getChunk(0, 0, 0));

    layer.removeVoxelAt({ x: 0, y: 0, z: 0 });

    assert.equal(layer.getChunk(0, 0, 0), undefined);
    assert.equal(layer.chunkCount, 0);
  });
});

describe("VoxelLayer chunk range edges", () => {
  it("answers undefined rather than throwing for a chunk past the range", () => {
    const layer = makeLayer({ chunkSize: 4 });

    assert.equal(layer.getChunk(kOutOfRangeCoord, 0, 0), undefined);
    assert.equal(layer.getChunk(0, -kOutOfRangeCoord, 0), undefined);
  });

  it("marks a neighbour past the edge of the world without throwing", () => {
    const layer = makeLayer({ chunkSize: 4 });

    assert.doesNotThrow(() => layer.markChunkDirty(-kOutOfRangeCoord, 0, 0));
  });
});

describe("VoxelLayer loadPackedVoxels", () => {
  it("writes layer-local voxels across chunks", () => {
    const layer = makeLayer({ position: { x: 10, y: 0, z: 0 } });
    const positions = new Int32Array([
      0, 0, 0,
      5, 1, -3,
      0, 0, 1,
      -1, 2, 2
    ]);

    layer.loadPackedVoxels(positions, [256, 513, 770, 1027]);

    assert.equal(layer.getPackedVoxelAt({ x: 10, y: 0, z: 0 }), 256);
    assert.equal(layer.getPackedVoxelAt({ x: 15, y: 1, z: -3 }), 513);
    assert.equal(layer.getPackedVoxelAt({ x: 10, y: 0, z: 1 }), 770);
    assert.equal(layer.getPackedVoxelAt({ x: 9, y: 2, z: 2 }), 1027);
    assert.equal(layer.voxelCount, 4);
    assert.equal(layer.chunkCount, 3);
  });

  it("marks the written chunks dirty", () => {
    const layer = makeLayer();

    layer.loadPackedVoxels(new Int32Array([1, 1, 1]), [256]);

    assert.equal(layer.getChunk(0, 0, 0)?.dirty, true);
  });
});

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
