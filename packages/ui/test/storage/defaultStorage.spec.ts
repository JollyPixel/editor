// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { StorageAdapter } from "../../src/storage/StorageAdapter.ts";

// CONSTANTS
const kValues = new Map<string, string>();
const kModule = new URL(
  "../../src/storage/defaultStorage.ts?failing-storage",
  import.meta.url
);

describe("Storage.defaultStorageAdapter", () => {
  let storage: PropertyDescriptor | undefined;
  let defaultStorageAdapter: () => StorageAdapter;

  before(async() => {
    storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => kValues.get(key) ?? null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        }
      }
    });
    ({ defaultStorageAdapter } = await import(kModule.href));
  });
  after(() => {
    if (storage === undefined) {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
    else {
      Object.defineProperty(globalThis, "localStorage", storage);
    }
  });

  test("a replacement element still sees a value written after storage failed", () => {
    const first = defaultStorageAdapter();
    first.set("jolly-stats:metric", "ms");

    const replacement = defaultStorageAdapter();

    assert.equal(replacement.get("jolly-stats:metric"), "ms");
  });
});
