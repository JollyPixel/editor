// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelChunk, DEFAULT_CHUNK_SIZE } from "../../../../src/document/world/index.ts";
import {
  makeVoxelEntry,
  writeChunkVoxel
} from "../../../helpers/voxelEntry.ts";

describe("VoxelChunk constructor", () => {
  it("stores chunk coords", () => {
    const chunk = new VoxelChunk([3, -1, 7]);
    assert.equal(chunk.cx, 3);
    assert.equal(chunk.cy, -1);
    assert.equal(chunk.cz, 7);
  });

  it("defaults to DEFAULT_CHUNK_SIZE", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.size, DEFAULT_CHUNK_SIZE);
  });

  it("respects custom size", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    assert.equal(chunk.size, 8);
  });

  it("starts dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.dirty, true);
  });

  it("starts empty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.isEmpty(), true);
    assert.equal(chunk.voxelCount, 0);
  });
});

describe("VoxelChunk set / get", () => {
  it("get returns undefined for empty coords", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.voxelAt(0, 0, 0), undefined);
  });

  it("returns stored entry after set", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    const entry = makeVoxelEntry(5, 2);
    writeChunkVoxel(chunk, [1, 2, 3], entry);
    assert.deepEqual(chunk.voxelAt(1, 2, 3), entry);
  });

  it("get returns undefined for a different coord", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [1, 0, 0], makeVoxelEntry());
    assert.equal(chunk.voxelAt(2, 0, 0), undefined);
  });

  it("overwrite replaces the entry", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    const first = makeVoxelEntry(1);
    const second = makeVoxelEntry(2);
    writeChunkVoxel(chunk, [0, 0, 0], first);
    writeChunkVoxel(chunk, [0, 0, 0], second);
    assert.deepEqual(chunk.voxelAt(0, 0, 0), second);
  });
});

describe("VoxelChunk dirty flag", () => {
  it("set marks dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.dirty = false;
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry());
    assert.equal(chunk.dirty, true);
  });

  it("get does not change dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry());
    chunk.dirty = false;
    chunk.voxelAt(0, 0, 0);
    assert.equal(chunk.dirty, false);
  });

  it("delete of existing entry marks dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry());
    chunk.dirty = false;
    chunk.removeAt(0, 0, 0);
    assert.equal(chunk.dirty, true);
  });

  it("delete of missing entry does NOT mark dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.dirty = false;
    chunk.removeAt(0, 0, 0);
    assert.equal(chunk.dirty, false);
  });
});

describe("VoxelChunk delete", () => {
  it("returns true when entry existed", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry());
    assert.equal(chunk.removeAt(0, 0, 0), true);
  });

  it("returns false when entry did not exist", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.removeAt(0, 0, 0), false);
  });

  it("entry is gone after delete", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [5, 5, 5], makeVoxelEntry());
    chunk.removeAt(5, 5, 5);
    assert.equal(chunk.voxelAt(5, 5, 5), undefined);
  });
});

describe("VoxelChunk isEmpty / voxelCount", () => {
  it("isEmpty is false and voxelCount increments after set", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry());
    assert.equal(chunk.isEmpty(), false);
    assert.equal(chunk.voxelCount, 1);
    writeChunkVoxel(chunk, [1, 0, 0], makeVoxelEntry());
    assert.equal(chunk.voxelCount, 2);
  });

  it("voxelCount decrements after delete", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry());
    writeChunkVoxel(chunk, [1, 0, 0], makeVoxelEntry());
    chunk.removeAt(0, 0, 0);
    assert.equal(chunk.voxelCount, 1);
  });

  it("overwriting the same cell does not increase voxelCount", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry(1));
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry(2));
    assert.equal(chunk.voxelCount, 1);
  });
});

describe("VoxelChunk entries()", () => {
  it("iterates all stored entries with their linear indices", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    const e1 = makeVoxelEntry(1);
    const e2 = makeVoxelEntry(2);
    writeChunkVoxel(chunk, [0, 0, 0], e1);
    writeChunkVoxel(chunk, [2, 1, 3], e2);

    const collected = new Map<number, typeof e1>();
    for (const [idx, entry] of chunk.entries()) {
      collected.set(idx, entry);
    }

    assert.equal(collected.size, 2);
    assert.deepEqual(collected.get(chunk.linearIndex(0, 0, 0)), e1);
    assert.deepEqual(collected.get(chunk.linearIndex(2, 1, 3)), e2);
  });
});

describe("VoxelChunk voxelAt()", () => {
  it("returns the same entry as get() without the tuple", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    const entry = makeVoxelEntry(7);
    writeChunkVoxel(chunk, [1, 2, 3], entry);

    assert.deepEqual(chunk.voxelAt(1, 2, 3), entry);
    assert.equal(chunk.voxelAt(3, 2, 1), undefined);
  });
});

describe("VoxelChunk mayContain()", () => {
  it("is false everywhere while the chunk is empty", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);

    assert.equal(chunk.mayContain(0, 0, 0), false);
    assert.equal(chunk.mayContain(2, 2, 2), false);
  });

  it("covers every written voxel and rejects positions outside their box", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    writeChunkVoxel(chunk, [2, 3, 4], makeVoxelEntry(1));
    writeChunkVoxel(chunk, [5, 3, 4], makeVoxelEntry(2));

    assert.equal(chunk.mayContain(2, 3, 4), true);
    assert.equal(chunk.mayContain(5, 3, 4), true);
    assert.equal(chunk.mayContain(3, 3, 4), true);

    assert.equal(chunk.mayContain(1, 3, 4), false);
    assert.equal(chunk.mayContain(2, 2, 4), false);
    assert.equal(chunk.mayContain(2, 3, 5), false);
  });

  it("stays conservative after a delete rather than shrinking", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    writeChunkVoxel(chunk, [1, 1, 1], makeVoxelEntry(1));
    writeChunkVoxel(chunk, [6, 6, 6], makeVoxelEntry(2));
    chunk.removeAt(6, 6, 6);

    assert.equal(chunk.voxelAt(6, 6, 6), undefined);
    assert.equal(chunk.mayContain(6, 6, 6), true);
  });
});

describe("VoxelChunk contentBounds()", () => {
  it("is null while the chunk holds no voxel", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    assert.equal(chunk.contentBounds(), null);

    writeChunkVoxel(chunk, [1, 2, 3], makeVoxelEntry(1));
    chunk.removeAt(1, 2, 3);
    assert.equal(chunk.contentBounds(), null);
  });

  it("spans the stored voxels exactly, shrinking after a delete", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    writeChunkVoxel(chunk, [2, 3, 4], makeVoxelEntry(1));
    writeChunkVoxel(chunk, [5, 1, 6], makeVoxelEntry(2));
    writeChunkVoxel(chunk, [7, 7, 7], makeVoxelEntry(3));
    chunk.removeAt(7, 7, 7);

    assert.deepEqual(chunk.contentBounds(), {
      minX: 2,
      minY: 1,
      minZ: 4,
      maxX: 5,
      maxY: 3,
      maxZ: 6
    });
  });

  it("reuses its bounds until the chunk changes", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    writeChunkVoxel(chunk, [0, 0, 0], makeVoxelEntry(1));

    const first = chunk.contentBounds();
    assert.equal(chunk.contentBounds(), first);

    writeChunkVoxel(chunk, [3, 0, 0], makeVoxelEntry(1));
    assert.notEqual(chunk.contentBounds(), first);
    assert.equal(chunk.contentBounds()?.maxX, 3);
  });
});

describe("VoxelChunk power-of-two size", () => {
  it("exposes shift and mask matching the size", () => {
    const chunk = new VoxelChunk([0, 0, 0], 32);
    assert.equal(chunk.shift, 5);
    assert.equal(chunk.mask, 31);
  });

  it("rejects a non power-of-two size", () => {
    assert.throws(
      () => new VoxelChunk([0, 0, 0], 6),
      /chunkSize must be a power of two, received 6/
    );
  });

  it("rejects a zero or negative size", () => {
    assert.throws(() => new VoxelChunk([0, 0, 0], 0), RangeError);
    assert.throws(() => new VoxelChunk([0, 0, 0], -8), RangeError);
  });

  it("round-trips every local coordinate through the linear index", () => {
    const size = 8;
    const chunk = new VoxelChunk([0, 0, 0], size);

    for (let lz = 0; lz < size; lz++) {
      for (let ly = 0; ly < size; ly++) {
        for (let lx = 0; lx < size; lx++) {
          const idx = chunk.linearIndex(lx, ly, lz);
          assert.deepEqual(chunk.fromLinearIndex(idx), { lx, ly, lz });
        }
      }
    }
  });
});
