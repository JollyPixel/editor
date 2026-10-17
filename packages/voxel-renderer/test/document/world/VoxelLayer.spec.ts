// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VOXEL_ABSENT, VoxelLayer } from "../../../src/document/world/index.ts";
import { AIR_BLOCK_ID } from "../../../src/document/blocks/index.ts";
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

describe("VoxelLayer constructor", () => {
  it("sets id, name and order from options", () => {
    const layer = makeLayer({ id: "l1", name: "Ground", order: 2 });

    assert.equal(layer.id, "l1");
    assert.equal(layer.name, "Ground");
    assert.equal(layer.order, 2);
  });

  it("defaults to a visible, empty layer at the origin", () => {
    const layer = makeLayer();

    assert.equal(layer.visible, true);
    assert.deepEqual(layer.position, { x: 0, y: 0, z: 0 });
    assert.equal(layer.chunkCount, 0);
  });

  it("respects explicit options", () => {
    const layer = makeLayer({ visible: false, position: { x: 16, y: 0, z: -8 } });

    assert.equal(layer.visible, false);
    assert.deepEqual(layer.position, { x: 16, y: 0, z: -8 });
  });
});

describe("VoxelLayer.markBoxDirty", () => {
  it("dirties the existing chunks overlapping a world box, through the layer position", () => {
    const layer = makeLayer({ chunkSize: 4, position: { x: 4, y: 0, z: 0 } });
    for (const x of [0, 4, 8]) {
      layer.setVoxelAt({ x: x + 4, y: 0, z: 0 }, makeVoxelEntry());
    }
    for (const chunk of layer.getChunks()) {
      chunk.dirty = false;
    }

    layer.markBoxDirty({ x: 7, y: 0, z: 0 }, { x: 8, y: 0, z: 0 });

    assert.deepEqual(
      [...layer.getChunks()].map((chunk) => [chunk.cx, chunk.dirty]),
      [[0, true], [1, true], [2, false]]
    );
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

  it("shrinks its bounds when the outermost voxel is removed", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());
    layer.setVoxelAt({ x: 9, y: 5, z: -6 }, makeVoxelEntry());
    layer.localBounds();

    layer.removeVoxelAt({ x: 9, y: 5, z: -6 });

    const local = layer.localBounds();
    assert.ok(local !== null);
    assert.deepEqual(local.min.toArray(), [0, 0, 0]);
    assert.deepEqual(local.max.toArray(), [1, 1, 1]);
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
    assert.deepEqual(Array.from(layer.localVoxels(), ([x, y, z]) => `${x},${y},${z}`).sort(), [
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

  it("treats an absent packed write as a removal", () => {
    const layer = makeLayer();
    layer.setVoxelAt({ x: 0, y: 0, z: 0 }, makeVoxelEntry());

    layer.setPackedVoxelAt({ x: 0, y: 0, z: 0 }, VOXEL_ABSENT);

    assert.equal(layer.getVoxelAt({ x: 0, y: 0, z: 0 }), undefined);
    assert.equal(layer.chunkCount, 0);
  });

  it("does nothing for a position that was never set", () => {
    const layer = makeLayer();

    layer.removeVoxelAt({ x: 99, y: 0, z: 0 });

    assert.equal(layer.chunkCount, 0);
    assert.equal(layer.voxelCount, 0);
    assert.deepEqual([...layer.drainPendingRemovals()], []);
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
  it("returns the same instance on subsequent calls", () => {
    const layer = makeLayer();
    const c1 = layer.getOrCreateChunk(0, 0, 0);
    const c2 = layer.getOrCreateChunk(0, 0, 0);
    assert.equal(c1, c2);
  });
});
