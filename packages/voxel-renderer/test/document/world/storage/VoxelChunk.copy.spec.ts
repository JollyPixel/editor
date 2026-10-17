// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelChunk } from "../../../../src/document/world/index.ts";
import { makeVoxelEntry } from "../../../helpers/voxelEntry.ts";

describe("VoxelChunk clone()", () => {
  it("carries coordinates, size and voxels over", () => {
    const chunk = new VoxelChunk([1, 2, 3], 8);
    const entry = makeVoxelEntry(7, 2);
    chunk.set([1, 2, 3], entry);
    chunk.set([4, 5, 6], makeVoxelEntry(9, 1));

    const copy = chunk.clone();

    assert.equal(copy.cx, 1);
    assert.equal(copy.cy, 2);
    assert.equal(copy.cz, 3);
    assert.equal(copy.size, 8);
    assert.equal(copy.voxelCount, 2);
    assert.deepEqual(copy.get([1, 2, 3]), entry);
    assert.deepEqual([...copy.packedEntries()], [...chunk.packedEntries()]);
  });

  it("carries the conservative bounds over", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    chunk.set([2, 2, 2], makeVoxelEntry());
    chunk.set([5, 5, 5], makeVoxelEntry());

    const copy = chunk.clone();

    assert.equal(copy.mayContain(3, 3, 3), true);
    assert.equal(copy.mayContain(6, 6, 6), false);
    assert.equal(copy.mayContain(1, 1, 1), false);
  });

  it("marks the copy dirty so it gets meshed", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    chunk.set([0, 0, 0], makeVoxelEntry());
    chunk.dirty = false;

    assert.equal(chunk.clone().dirty, true);
  });

  it("shares no storage with the source", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    chunk.set([0, 0, 0], makeVoxelEntry(1, 0));

    const copy = chunk.clone();
    copy.set([0, 0, 0], makeVoxelEntry(5, 0));
    copy.set([7, 7, 7], makeVoxelEntry(6, 0));
    copy.delete([0, 0, 0]);

    assert.deepEqual(chunk.get([0, 0, 0]), makeVoxelEntry(1, 0));
    assert.equal(chunk.get([7, 7, 7]), undefined);
    assert.equal(chunk.voxelCount, 1);
  });

  it("copies an empty chunk without inventing voxels", () => {
    const copy = new VoxelChunk([0, 0, 0], 8).clone();

    assert.equal(copy.isEmpty(), true);
    assert.equal(copy.voxelCount, 0);
  });
});

describe("VoxelChunk copyFrom()", () => {
  it("replaces storage and bounds while keeping the target identity", () => {
    const target = new VoxelChunk([1, 2, 3], 8);
    const source = new VoxelChunk([4, 5, 6], 8);
    target.set([0, 0, 0], makeVoxelEntry(1, 0));
    source.set([5, 6, 7], makeVoxelEntry(2, 1));

    target.copyFrom(source);

    assert.equal(target.cx, 1);
    assert.equal(target.cy, 2);
    assert.equal(target.cz, 3);
    assert.equal(target.get([0, 0, 0]), undefined);
    assert.deepEqual(target.get([5, 6, 7]), makeVoxelEntry(2, 1));
    assert.equal(target.mayContain(5, 6, 7), true);
    assert.equal(target.dirty, true);
  });

  it("rejects a source with a different chunk size", () => {
    const target = new VoxelChunk([0, 0, 0], 8);
    const source = new VoxelChunk([0, 0, 0], 16);

    assert.throws(() => target.copyFrom(source), RangeError);
  });
});

describe("VoxelChunk merged cells", () => {
  it("keeps the second shapes when copied or cloned", () => {
    const source = new VoxelChunk([0, 0, 0], 4);
    source.set([0, 0, 0], {
      ...makeVoxelEntry(1),
      partner: makeVoxelEntry(2)
    });
    const target = new VoxelChunk([0, 0, 0], 4);
    target.set([1, 0, 0], {
      ...makeVoxelEntry(3),
      partner: makeVoxelEntry(4)
    });

    target.copyFrom(source);

    assert.deepEqual(target.get([0, 0, 0])?.partner, makeVoxelEntry(2));
    assert.equal(target.get([1, 0, 0]), undefined);
    assert.equal(source.clone().get([0, 0, 0])?.partner?.blockId, 2);
  });

  it("orders the two shapes the same way whichever was written first", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    chunk.set([0, 0, 0], {
      ...makeVoxelEntry(2),
      partner: makeVoxelEntry(1)
    });
    chunk.set([1, 0, 0], {
      ...makeVoxelEntry(1),
      partner: makeVoxelEntry(2)
    });

    assert.deepEqual(chunk.get([0, 0, 0]), chunk.get([1, 0, 0]));
  });
});
