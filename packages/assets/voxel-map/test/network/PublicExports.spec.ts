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
  test("root exports persistence APIs of both kinds only", () => {
    assert.strictEqual(typeof root.voxelMapAssetKind, "function");
    assert.strictEqual(typeof root.VoxelMapState, "function");
    assert.strictEqual(typeof root.blocksetAssetKind, "function");
    assert.strictEqual(typeof root.BlocksetState, "function");
    assert.strictEqual(typeof root.blocksetDocumentFromPng, "function");
    assert.strictEqual(root.BLOCKSET_ASSET.kind, root.BLOCKSET_KIND);
    assert.strictEqual("VoxelSyncClient" in root, false);
    assert.strictEqual("BlocksetSyncClient" in root, false);
  });

  test("client exports browser synchronization of maps and blocksets", () => {
    assert.strictEqual(typeof client.VoxelSyncClient, "function");
    assert.strictEqual(typeof client.voxelMapDocumentKind, "function");
    assert.strictEqual(typeof client.BlocksetSyncClient, "function");
    assert.strictEqual(typeof client.SyncedBlockset, "function");
    assert.strictEqual(typeof client.blocksetDocumentKind, "function");
    assert.strictEqual(typeof client.createBlocksetAsset, "function");
    assert.strictEqual(typeof client.blocksetAsset, "function");
    assert.strictEqual(client.BLOCKSET_KIND, root.BLOCKSET_KIND);
  });

  test("server exports authoritative synchronization of both rooms", () => {
    assert.strictEqual(typeof server.VoxelCommandArbiter, "function");
    assert.strictEqual(typeof server.BlocksetCommandArbiter, "function");
    assert.strictEqual(typeof server.blocksetCommandProtocol, "object");
  });
});
