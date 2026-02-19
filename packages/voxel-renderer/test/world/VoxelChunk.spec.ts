// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelChunk, DEFAULT_CHUNK_SIZE } from "../../src/world/VoxelChunk.ts";

function makeEntry(blockId = 1, transform = 0) {
  return { blockId, transform };
}

describe("DEFAULT_CHUNK_SIZE", () => {
  it("is 16", () => {
    assert.equal(DEFAULT_CHUNK_SIZE, 16);
  });
});

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

describe("linearIndex / fromLinearIndex", () => {
  it("[0,0,0] has index 0", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.linearIndex(0, 0, 0), 0);
  });

  it("[1,0,0] has index 1", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.linearIndex(1, 0, 0), 1);
  });

  it("[0,1,0] has index size", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    assert.equal(chunk.linearIndex(0, 1, 0), 4);
  });

  it("[0,0,1] has index size²", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    assert.equal(chunk.linearIndex(0, 0, 1), 16);
  });

  it("round-trips arbitrary coords via fromLinearIndex", () => {
    const chunk = new VoxelChunk([0, 0, 0], 8);
    const cases = [[0, 0, 0], [3, 5, 7], [7, 7, 7], [1, 0, 2]] as const;

    for (const [lx, ly, lz] of cases) {
      const idx = chunk.linearIndex(lx, ly, lz);
      const back = chunk.fromLinearIndex(idx);
      assert.equal(back.lx, lx, `lx mismatch for ${lx},${ly},${lz}`);
      assert.equal(back.ly, ly, `ly mismatch for ${lx},${ly},${lz}`);
      assert.equal(back.lz, lz, `lz mismatch for ${lx},${ly},${lz}`);
    }
  });
});

describe("set / get", () => {
  it("get returns undefined for empty coords", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.get([0, 0, 0]), undefined);
  });

  it("returns stored entry after set", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    const entry = makeEntry(5, 2);
    chunk.set([1, 2, 3], entry);
    assert.equal(chunk.get([1, 2, 3]), entry);
  });

  it("get returns undefined for a different coord", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([1, 0, 0], makeEntry());
    assert.equal(chunk.get([2, 0, 0]), undefined);
  });

  it("overwrite replaces the entry", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    const first = makeEntry(1);
    const second = makeEntry(2);
    chunk.set([0, 0, 0], first);
    chunk.set([0, 0, 0], second);
    assert.equal(chunk.get([0, 0, 0]), second);
  });
});

describe("dirty flag", () => {
  it("set marks dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.dirty = false;
    chunk.set([0, 0, 0], makeEntry());
    assert.equal(chunk.dirty, true);
  });

  it("get does not change dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([0, 0, 0], makeEntry());
    chunk.dirty = false;
    chunk.get([0, 0, 0]);
    assert.equal(chunk.dirty, false);
  });

  it("delete of existing entry marks dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([0, 0, 0], makeEntry());
    chunk.dirty = false;
    chunk.delete([0, 0, 0]);
    assert.equal(chunk.dirty, true);
  });

  it("delete of missing entry does NOT mark dirty", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.dirty = false;
    chunk.delete([0, 0, 0]);
    assert.equal(chunk.dirty, false);
  });
});

describe("delete", () => {
  it("returns true when entry existed", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([0, 0, 0], makeEntry());
    assert.equal(chunk.delete([0, 0, 0]), true);
  });

  it("returns false when entry did not exist", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.delete([0, 0, 0]), false);
  });

  it("entry is gone after delete", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([5, 5, 5], makeEntry());
    chunk.delete([5, 5, 5]);
    assert.equal(chunk.get([5, 5, 5]), undefined);
  });
});

describe("isEmpty / voxelCount", () => {
  it("isEmpty is true and voxelCount is 0 for fresh chunk", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    assert.equal(chunk.isEmpty(), true);
    assert.equal(chunk.voxelCount, 0);
  });

  it("isEmpty is false and voxelCount increments after set", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([0, 0, 0], makeEntry());
    assert.equal(chunk.isEmpty(), false);
    assert.equal(chunk.voxelCount, 1);
    chunk.set([1, 0, 0], makeEntry());
    assert.equal(chunk.voxelCount, 2);
  });

  it("voxelCount decrements after delete", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([0, 0, 0], makeEntry());
    chunk.set([1, 0, 0], makeEntry());
    chunk.delete([0, 0, 0]);
    assert.equal(chunk.voxelCount, 1);
  });

  it("overwriting the same cell does not increase voxelCount", () => {
    const chunk = new VoxelChunk([0, 0, 0]);
    chunk.set([0, 0, 0], makeEntry(1));
    chunk.set([0, 0, 0], makeEntry(2));
    assert.equal(chunk.voxelCount, 1);
  });
});

describe("entries()", () => {
  it("iterates all stored entries with their linear indices", () => {
    const chunk = new VoxelChunk([0, 0, 0], 4);
    const e1 = makeEntry(1);
    const e2 = makeEntry(2);
    chunk.set([0, 0, 0], e1);
    chunk.set([2, 1, 3], e2);

    const collected = new Map<number, typeof e1>();
    for (const [idx, entry] of chunk.entries()) {
      collected.set(idx, entry);
    }

    assert.equal(collected.size, 2);
    assert.equal(collected.get(chunk.linearIndex(0, 0, 0)), e1);
    assert.equal(collected.get(chunk.linearIndex(2, 1, 3)), e2);
  });
});
