// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import * as root from "#src/index.ts";
import * as client from "#src/network/client.ts";
import * as server from "#src/network/server.ts";

describe("public entry points", () => {
  test("root exports persistence APIs only", () => {
    assert.strictEqual(typeof root.voxelMapAssetHandler, "function");
    assert.strictEqual(typeof root.VoxelMapState, "function");
    assert.strictEqual("VoxelSyncClient" in root, false);
  });

  test("client exports browser synchronization", () => {
    assert.strictEqual(typeof client.VoxelSyncClient, "function");
  });

  test("server exports authoritative synchronization", () => {
    assert.strictEqual(typeof server.VoxelCommandArbiter, "function");
  });
});
