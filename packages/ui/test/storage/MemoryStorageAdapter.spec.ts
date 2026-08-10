// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { MemoryStorageAdapter } from "../../src/storage/MemoryStorageAdapter.ts";

describe("Storage.MemoryStorageAdapter", () => {
  test("round trips a value", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.set("a", "1");

    assert.equal(adapter.get("a"), "1");
  });

  test("overwrites an existing key", () => {
    const adapter = new MemoryStorageAdapter();
    adapter.set("a", "1");
    adapter.set("a", "2");

    assert.equal(adapter.get("a"), "2");
  });

  test("returns null for an unknown key", () => {
    assert.equal(
      new MemoryStorageAdapter().get("missing"),
      null
    );
  });

  test("keeps instances isolated", () => {
    const first = new MemoryStorageAdapter();
    first.set("a", "1");

    assert.equal(
      new MemoryStorageAdapter().get("a"),
      null
    );
  });
});
