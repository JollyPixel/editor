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
    assert.strictEqual(typeof root.tilesetAssetKind, "function");
    assert.strictEqual(typeof root.TilesetState, "function");
    assert.strictEqual(typeof root.tilesetDocumentFromPng, "function");
    assert.strictEqual(root.TILESET_ASSET.kind, root.TILESET_KIND);
    assert.strictEqual("VoxelSyncClient" in root, false);
    assert.strictEqual("TilesetSyncClient" in root, false);
  });

  test("client exports browser synchronization of maps and tilesets", () => {
    assert.strictEqual(typeof client.VoxelSyncClient, "function");
    assert.strictEqual(typeof client.voxelMapDocumentKind, "function");
    assert.strictEqual(typeof client.TilesetSyncClient, "function");
    assert.strictEqual(typeof client.SyncedTileset, "function");
    assert.strictEqual(typeof client.tilesetDocumentKind, "function");
    assert.strictEqual(typeof client.createTilesetAsset, "function");
    assert.strictEqual(typeof client.tilesetAsset, "function");
    assert.strictEqual(client.TILESET_KIND, root.TILESET_KIND);
  });

  test("server exports authoritative synchronization of both rooms", () => {
    assert.strictEqual(typeof server.VoxelCommandArbiter, "function");
    assert.strictEqual(typeof server.TilesetCommandArbiter, "function");
    assert.strictEqual(typeof server.tilesetCommandProtocol, "object");
  });
});
