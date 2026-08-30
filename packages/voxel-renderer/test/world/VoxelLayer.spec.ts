// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelLayer } from "../../src/world/VoxelLayer.ts";
import { AIR_BLOCK_ID } from "../../src/blocks/BlockId.ts";
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

describe("VoxelLayer opacity", () => {
  it("defaults opacity to 1", () => {
    assert.equal(makeLayer().opacity, 1);
  });

  it("respects explicit opacity", () => {
    assert.equal(makeLayer({ opacity: 0.5 }).opacity, 0.5);
  });

  it("clamps a constructor opacity above 1 to 1", () => {
    assert.equal(makeLayer({ opacity: 5 }).opacity, 1);
  });

  it("clamps a constructor opacity below 0 to 0", () => {
    assert.equal(makeLayer({ opacity: -5 }).opacity, 0);
  });

  it("clamps a setter opacity above 1 to 1", () => {
    const layer = makeLayer();
    layer.opacity = 2;
    assert.equal(layer.opacity, 1);
  });

  it("clamps a setter opacity below 0 to 0", () => {
    const layer = makeLayer();
    layer.opacity = -1;
    assert.equal(layer.opacity, 0);
  });

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
    // Still effectively invisible before and after — no new transition.
    assert.equal(layer.wasVisible, true);
  });

  it("setting visible=false while opacity=0 keeps wasVisible true (still effectively invisible)", () => {
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
    // cx=1
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
    // Chunk cx for x=-1 is floor(-1/4) = -1
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

describe("VoxelLayer offset arithmetic", () => {
  it("with offset {x:8}, world pos {x:8,y:0,z:0} lands in chunk 0 of the layer", () => {
    const layer = makeLayer({ chunkSize: 4, offset: { x: 8, y: 0, z: 0 } });
    const entry = makeVoxelEntry();
    layer.setVoxelAt({ x: 8, y: 0, z: 0 }, entry);
    // local x = 8-8 = 0 → cx=0
    const chunk = layer.getChunk(0, 0, 0);
    assert.ok(chunk !== undefined);
    assert.deepEqual(layer.getVoxelAt({ x: 8, y: 0, z: 0 }), entry);
  });

  it("offset shifts all accesses by the same amount", () => {
    const layer = makeLayer({ chunkSize: 16, offset: { x: 100, y: 0, z: 0 } });
    const entry = makeVoxelEntry(42);
    layer.setVoxelAt({ x: 100, y: 0, z: 0 }, entry);
    assert.deepEqual(layer.getVoxelAt({ x: 100, y: 0, z: 0 }), entry);
    assert.equal(layer.getVoxelAt({ x: 99, y: 0, z: 0 }), undefined);
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

describe("VoxelLayer toJSON", () => {
  it("includes opacity", () => {
    const layer = makeLayer({ opacity: 0.5 });
    assert.equal(layer.toJSON().opacity, 0.5);
  });

  it("defaults opacity to 1 when not set", () => {
    assert.equal(makeLayer().toJSON().opacity, 1);
  });
});

describe("VoxelLayer clone", () => {
  it("should clone a layer", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const clone = layer.clone();
    assert.deepEqual(clone.toJSON(), layer.toJSON());
    assert.notEqual(clone, layer);
  });

  it("should be able to overide or add value on the fly", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const clone = layer.clone({ visible: false, name: "Cloned" });
    assert.deepEqual(clone.toJSON(), {
      ...layer.toJSON(), visible: false, name: "Cloned"
    });
  });

  it("preserves opacity", () => {
    const layer = makeLayer({ chunkSize: 4, opacity: 0.3 });
    const clone = layer.clone();
    assert.equal(clone.opacity, 0.3);
  });
});

describe("VoxelLayer mergeFrom", () => {
  it("copies voxels at correct world positions (both layers at offset {0,0,0})", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const entry = makeVoxelEntry(5, 2);
    source.setVoxelAt({ x: 2, y: 1, z: 3 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 2, y: 1, z: 3 }), entry);
  });

  it("applies source offset: voxel at local (1,0,0) with source offset {5,0,0} lands at world (6,0,0)", () => {
    const source = makeLayer({ id: "src", name: "Source", offset: { x: 5, y: 0, z: 0 } });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const entry = makeVoxelEntry(3, 0);
    // Local (1,0,0) → world (6,0,0)
    source.setVoxelAt({ x: 6, y: 0, z: 0 }, entry);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 6, y: 0, z: 0 }), entry);
    assert.equal(target.getVoxelAt({ x: 1, y: 0, z: 0 }), undefined);
  });

  it("applies target offset: target with offset {3,0,0} stores world (6,0,0) at local (3,0,0)", () => {
    const source = makeLayer({ id: "src", name: "Source", offset: { x: 5, y: 0, z: 0 } });
    const target = makeLayer({ id: "tgt", name: "Target", offset: { x: 3, y: 0, z: 0 } });
    const entry = makeVoxelEntry(7, 1);
    source.setVoxelAt({ x: 6, y: 0, z: 0 }, entry);

    target.mergeFrom(source);

    // World (6,0,0) should be in target (local (3,0,0))
    assert.deepEqual(target.getVoxelAt({ x: 6, y: 0, z: 0 }), entry);
  });

  it("source voxel overwrites existing target voxel at same world position", () => {
    const source = makeLayer({ id: "src", name: "Source" });
    const target = makeLayer({ id: "tgt", name: "Target" });
    const original = makeVoxelEntry(1, 0);
    const overwrite = makeVoxelEntry(9, 3);
    target.setVoxelAt({ x: 0, y: 0, z: 0 }, original);
    source.setVoxelAt({ x: 0, y: 0, z: 0 }, overwrite);

    target.mergeFrom(source);

    assert.deepEqual(target.getVoxelAt({ x: 0, y: 0, z: 0 }), overwrite);
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

  it("keeps negative chunk coordinates distinct", () => {
    const layer = makeLayer({ chunkSize: 4 });
    layer.setVoxelAt({ x: -1, y: -1, z: -1 }, makeVoxelEntry(1));
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry(2));

    assert.equal(layer.chunkCount, 2);
    const negEntry = layer.getVoxelAt({ x: -1, y: -1, z: -1 });
    assert.ok(negEntry !== undefined);
    assert.equal(negEntry.blockId, 1);
    const originEntry = layer.getVoxelAt({ x: 0, y: 0, z: 0 });
    assert.ok(originEntry !== undefined);
    assert.equal(originEntry.blockId, 2);
  });

  it("does not alias two chunks onto one key", () => {
    const layer = makeLayer({ chunkSize: 4 });
    const seen = new Set<number>();

    for (const cx of [-3, 0, 5]) {
      for (const cy of [-2, 0, 7]) {
        for (const cz of [-1, 0, 9]) {
          const chunk = layer.getOrCreateChunk(cx, cy, cz);
          assert.equal(seen.has(chunk.cx * 1e6 + chunk.cy * 1e3 + chunk.cz), false);
          seen.add(chunk.cx * 1e6 + chunk.cy * 1e3 + chunk.cz);
        }
      }
    }
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
    // Warms the memo.
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
