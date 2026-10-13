// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { UvSyncStore } from "../../src/state/UvSyncStore.ts";

describe("UvSyncStore", () => {
  test("writes the blocks on commit by default", () => {
    assert.equal(new UvSyncStore().mode, "commit");
  });

  test("falls back to commit for an unknown stored mode", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("voxel-map:uv-sync", "realtime");

    assert.equal(new UvSyncStore(storage).mode, "commit");
  });
});
