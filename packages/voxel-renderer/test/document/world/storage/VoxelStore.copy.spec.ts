// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VOXEL_ABSENT } from "../../../../src/document/world/index.ts";
import { VoxelStore } from "../../../../src/document/world/storage/VoxelStore.ts";

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

describe("VoxelStore copyFrom", () => {
  it("reproduces every entry of the source", () => {
    const source = new VoxelStore();
    for (let key = 0; key < 40; key++) {
      source.set(key, key + 100);
    }

    const target = new VoxelStore();
    target.copyFrom(source);

    assert.equal(target.size, source.size);
    assert.equal(target.capacity, source.capacity);
    assert.deepEqual(collect(target), collect(source));
    for (let key = 0; key < 40; key++) {
      assert.equal(target.get(key), key + 100);
    }
  });

  it("drops whatever the target held before", () => {
    const source = new VoxelStore();
    source.set(1, 11);

    const target = new VoxelStore();
    target.set(2, 22);
    target.set(3, 33);
    target.copyFrom(source);

    assert.equal(target.size, 1);
    assert.equal(target.get(1), 11);
    assert.equal(target.get(2), VOXEL_ABSENT);
    assert.equal(target.get(3), VOXEL_ABSENT);
  });

  it("shrinks a larger target back to the source capacity", () => {
    const source = new VoxelStore();
    source.set(1, 11);

    const target = new VoxelStore();
    for (let key = 0; key < 40; key++) {
      target.set(key, key);
    }
    assert.ok(target.capacity > source.capacity);

    target.copyFrom(source);

    assert.equal(target.capacity, source.capacity);
    assert.equal(target.size, 1);
    assert.equal(target.get(1), 11);
  });

  it("leaves the copy writable and independent of the source", () => {
    const source = new VoxelStore();
    source.set(1, 11);

    const target = new VoxelStore();
    target.copyFrom(source);
    for (let key = 2; key < 60; key++) {
      target.set(key, key);
    }
    target.delete(1);

    assert.equal(source.size, 1);
    assert.equal(source.get(1), 11);
    assert.equal(target.get(1), VOXEL_ABSENT);
    assert.equal(target.get(59), 59);
  });

  it("keeps deletion working after a copy, probe clusters intact", () => {
    const source = new VoxelStore();
    for (let key = 0; key < 12; key++) {
      source.set(key, key + 1);
    }

    const target = new VoxelStore();
    target.copyFrom(source);
    for (let key = 0; key < 12; key += 2) {
      assert.equal(target.delete(key), true);
    }

    assert.equal(target.size, 6);
    for (let key = 1; key < 12; key += 2) {
      assert.equal(target.get(key), key + 1);
    }
  });
});

describe("VoxelStore reserve", () => {
  it("grows once so the reserved entries fit without another rehash", () => {
    const store = new VoxelStore();
    store.reserve(100);
    const capacity = store.capacity;

    for (let key = 0; key < 100; key++) {
      store.set(key, key + 1);
    }

    assert.equal(store.capacity, capacity);
    assert.equal(store.size, 100);
  });

  it("keeps every entry when it rehashes", () => {
    const store = new VoxelStore();
    for (let key = 0; key < 10; key++) {
      store.set(key * 17, key);
    }

    store.reserve(1_000);

    assert.deepEqual(
      collect(store),
      new Map(Array.from({ length: 10 }, (_, key) => [key * 17, key]))
    );
  });

  it("never shrinks the table", () => {
    const store = new VoxelStore(256);
    const capacity = store.capacity;

    store.reserve(1);

    assert.equal(store.capacity, capacity);
  });
});

describe("VoxelStore shared memory", () => {
  it("moves its entries into SharedArrayBuffers", () => {
    const store = new VoxelStore();
    store.set(3, 30);
    store.set(99, 990);

    store.share();

    assert.equal(store.shared, true);
    assert.ok(store.keys.buffer instanceof SharedArrayBuffer);
    assert.ok(store.values.buffer instanceof SharedArrayBuffer);
    assert.deepEqual(collect(store), new Map([[3, 30], [99, 990]]));
  });

  it("stays shared when it grows", () => {
    const store = new VoxelStore();
    store.share();

    for (let key = 0; key < 100; key++) {
      store.set(key, key);
    }

    assert.ok(store.keys.buffer instanceof SharedArrayBuffer);
    assert.ok(store.values.buffer instanceof SharedArrayBuffer);
    assert.equal(store.get(99), 99);
  });

  it("reads another store's arrays and sees its later writes", () => {
    const owner = new VoxelStore();
    owner.set(7, 70);
    owner.share();

    const view = VoxelStore.fromArrays(owner.keys, owner.values, owner.size);
    owner.set(8, 80);

    assert.equal(view.shared, true);
    assert.equal(view.get(7), 70);
    assert.equal(view.get(8), 80);
  });

  it("rejects arrays that are not one power-of-two table", () => {
    assert.throws(
      () => VoxelStore.fromArrays(new Int32Array(24), new Uint32Array(24), 0),
      RangeError
    );
    assert.throws(
      () => VoxelStore.fromArrays(new Int32Array(16), new Uint32Array(32), 0),
      RangeError
    );
  });
});
