// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  LocalStorageAdapter,
  type StorageLike
} from "../../src/storage/LocalStorageAdapter.ts";

function workingStorage(): StorageLike & { values: Map<string, string>; } {
  const values = new Map<string, string>();

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value)
  };
}

function throwingOnWrite(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    }
  };
}

describe("Storage.LocalStorageAdapter", () => {
  test("writes through to the backing store", () => {
    const storage = workingStorage();
    const adapter = new LocalStorageAdapter({
      resolve: () => storage
    });

    adapter.set("pane:left", "open");

    assert.equal(
      storage.values.get("pane:left"),
      "open"
    );
    assert.equal(adapter.get("pane:left"), "open");
    assert.equal(adapter.persistent, true);
  });

  test("falls back to memory when the property read throws, as in a sandboxed iframe", () => {
    const adapter = new LocalStorageAdapter({
      resolve: () => {
        throw new Error("SecurityError");
      }
    });

    assert.equal(adapter.persistent, false);

    adapter.set("a", "1");
    assert.equal(adapter.get("a"), "1");
  });

  test("falls back to memory when storage is absent entirely", () => {
    const adapter = new LocalStorageAdapter({
      resolve: () => undefined
    });

    adapter.set("a", "1");

    assert.equal(adapter.persistent, false);
    assert.equal(adapter.get("a"), "1");
  });

  test("degrades on a quota error at write time, long after construction succeeded", () => {
    const adapter = new LocalStorageAdapter({
      resolve: throwingOnWrite
    });
    assert.equal(adapter.persistent, true);

    adapter.set("a", "1");

    assert.equal(adapter.persistent, false);
    assert.equal(adapter.get("a"), "1");
  });

  test("keeps values written before storage gave out", () => {
    let failing = false;
    const values = new Map<string, string>();
    const adapter = new LocalStorageAdapter({
      resolve: () => {
        return {
          getItem: (key) => values.get(key) ?? null,
          setItem: (key, value) => {
            if (failing) {
              throw new Error("QuotaExceededError");
            }
            values.set(key, value);
          }
        };
      }
    });

    adapter.set("first", "1");
    failing = true;
    adapter.set("second", "2");

    assert.equal(adapter.persistent, false);
    assert.equal(adapter.get("first"), "1");
    assert.equal(adapter.get("second"), "2");
  });

  test("does not throw into a render when a write fails", () => {
    const adapter = new LocalStorageAdapter({
      resolve: throwingOnWrite
    });

    assert.doesNotThrow(() => adapter.set("a", "1"));
  });

  test("returns null for an unknown key", () => {
    const adapter = new LocalStorageAdapter({
      resolve: workingStorage
    });

    assert.equal(adapter.get("missing"), null);
  });
});
