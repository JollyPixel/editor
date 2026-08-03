// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelStore } from "../../src/world/VoxelStore.ts";
import { VOXEL_ABSENT } from "../../src/world/packedVoxel.ts";

function collect(
  store: VoxelStore
): Map<number, number> {
  const { keys, values, capacity } = store;
  const found = new Map<number, number>();

  for (let slot = 0; slot < capacity; slot++) {
    if (keys[slot] >= 0) {
      found.set(keys[slot], values[slot]);
    }
  }

  return found;
}

describe("VoxelStore constructor", () => {
  it("starts empty with a power-of-two capacity", () => {
    const store = new VoxelStore();

    assert.equal(store.size, 0);
    assert.equal(store.capacity & (store.capacity - 1), 0);
  });

  it("rounds a requested capacity up to a power of two", () => {
    assert.equal(new VoxelStore(1000).capacity, 1024);
    assert.equal(new VoxelStore(1024).capacity, 1024);
  });

  it("marks every slot free, including slot 0", () => {
    const store = new VoxelStore();

    assert.equal(store.get(0), VOXEL_ABSENT);
    assert.equal(collect(store).size, 0);
  });
});

describe("VoxelStore get / set", () => {
  it("returns VOXEL_ABSENT for a missing key", () => {
    const store = new VoxelStore();

    assert.equal(store.get(42), VOXEL_ABSENT);
    assert.equal(store.has(42), false);
  });

  it("reads back what was written", () => {
    const store = new VoxelStore();
    store.set(42, 7);

    assert.equal(store.get(42), 7);
    assert.equal(store.has(42), true);
    assert.equal(store.size, 1);
  });

  it("treats key 0 as a real key", () => {
    const store = new VoxelStore();
    store.set(0, 5);

    assert.equal(store.get(0), 5);
    assert.equal(store.size, 1);
  });

  it("stores a zero value distinctly from an absent key", () => {
    const store = new VoxelStore();
    store.set(3, 0);

    assert.equal(store.get(3), 0);
    assert.equal(store.get(4), VOXEL_ABSENT);
  });

  it("reports whether the key was new", () => {
    const store = new VoxelStore();

    assert.equal(store.set(1, 1), true);
    assert.equal(store.set(1, 2), false);
  });

  it("overwrites in place without growing the size", () => {
    const store = new VoxelStore();
    store.set(9, 1);
    store.set(9, 2);

    assert.equal(store.get(9), 2);
    assert.equal(store.size, 1);
  });
});

describe("VoxelStore growth", () => {
  it("keeps every entry retrievable across rehashes", () => {
    const store = new VoxelStore();
    const count = 5000;

    for (let i = 0; i < count; i++) {
      store.set(i * 7, i + 1);
    }

    assert.equal(store.size, count);
    assert.ok(store.capacity >= count);
    for (let i = 0; i < count; i++) {
      assert.equal(store.get(i * 7), i + 1, `key ${i * 7}`);
    }
  });

  it("never exceeds a 3/4 load factor", () => {
    const store = new VoxelStore();

    for (let i = 0; i < 2000; i++) {
      store.set(i, 1);
      assert.ok(
        store.size < (store.capacity * 3) / 4,
        `size ${store.size} of capacity ${store.capacity}`
      );
    }
  });

  it("iterating slots yields exactly the stored pairs", () => {
    const store = new VoxelStore();
    for (let i = 0; i < 500; i++) {
      store.set(i * 3, i + 1);
    }

    const found = collect(store);
    assert.equal(found.size, 500);
    for (let i = 0; i < 500; i++) {
      assert.equal(found.get(i * 3), i + 1);
    }
  });
});

describe("VoxelStore delete", () => {
  it("returns false for a missing key", () => {
    const store = new VoxelStore();

    assert.equal(store.delete(1), false);
    assert.equal(store.size, 0);
  });

  it("removes the entry and decrements the size", () => {
    const store = new VoxelStore();
    store.set(1, 10);
    store.set(2, 20);

    assert.equal(store.delete(1), true);
    assert.equal(store.get(1), VOXEL_ABSENT);
    assert.equal(store.get(2), 20);
    assert.equal(store.size, 1);
  });

  /**
   * Backward-shift deletion must not orphan a key that probed past the hole,
   * which is the classic failure mode of tombstone-free open addressing.
   */
  it("keeps colliding keys reachable after the one before them is deleted", () => {
    const store = new VoxelStore(16);
    const keys: number[] = [];

    // Enough keys that clusters form and probe sequences overlap.
    for (let i = 0; i < 10; i++) {
      keys.push(i);
      store.set(i, i + 1);
    }

    for (const removed of [3, 7, 0, 9]) {
      assert.equal(store.delete(removed), true);
      const index = keys.indexOf(removed);
      keys.splice(index, 1);

      for (const key of keys) {
        assert.equal(store.get(key), key + 1, `key ${key} after deleting ${removed}`);
      }
    }
  });

  it("survives an interleaved churn of writes and deletes", () => {
    const store = new VoxelStore();
    const reference = new Map<number, number>();

    let seed = 12345;
    function random(): number {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7FFFFFFF;

      return seed;
    }

    for (let step = 0; step < 20000; step++) {
      const key = random() % 800;
      if (random() % 3 === 0) {
        assert.equal(store.delete(key), reference.delete(key), `delete ${key}`);
      }
      else {
        const value = (random() % 1000) + 1;
        assert.equal(store.set(key, value), !reference.has(key), `set ${key}`);
        reference.set(key, value);
      }
      assert.equal(store.size, reference.size, `size at step ${step}`);
    }

    for (const [key, value] of reference) {
      assert.equal(store.get(key), value, `key ${key}`);
    }
    assert.deepEqual(collect(store), reference);
  });

  it("frees the slot so it can be reused", () => {
    const store = new VoxelStore();
    store.set(5, 1);
    store.delete(5);
    store.set(5, 2);

    assert.equal(store.get(5), 2);
    assert.equal(store.size, 1);
  });
});

describe("VoxelStore clear", () => {
  it("drops every entry but keeps the table usable", () => {
    const store = new VoxelStore();
    for (let i = 0; i < 100; i++) {
      store.set(i, i);
    }

    store.clear();

    assert.equal(store.size, 0);
    assert.equal(store.get(50), VOXEL_ABSENT);
    assert.equal(collect(store).size, 0);

    store.set(7, 3);
    assert.equal(store.get(7), 3);
  });
});
