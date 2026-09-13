// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// CONSTANTS
const kValues = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => kValues.get(key) ?? null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    }
  }
});

const { defaultStorageAdapter } = await import(
  "../../src/storage/defaultStorage.ts"
);

describe("Storage.defaultStorageAdapter", () => {
  test("returns one adapter for the page", () => {
    assert.equal(defaultStorageAdapter(), defaultStorageAdapter());
  });

  test("a replacement element still sees a value written after storage failed", () => {
    const first = defaultStorageAdapter();
    first.set("jolly-stats:metric", "ms");

    const replacement = defaultStorageAdapter();

    assert.equal(replacement.get("jolly-stats:metric"), "ms");
  });
});
