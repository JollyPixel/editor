// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as root from "#src/index.ts";
import * as client from "#src/network/client.ts";
import * as server from "#src/network/server.ts";

describe("network entry points", () => {
  test("root exports persistence APIs only", () => {
    assert.strictEqual(typeof root.pixelArtAssetKind, "function");
    assert.strictEqual(typeof root.PixelArtState, "function");
    assert.strictEqual("PixelSyncClient" in root, false);
  });

  test("client entry exports every browser sync helper", () => {
    assert.strictEqual(typeof client.PixelSyncClient, "function");
    assert.strictEqual(typeof client.PixelCollaboration, "function");
    assert.strictEqual(typeof client.PixelCursorSync, "function");
    assert.strictEqual(typeof client.PixelStrokeGhostSync, "function");
    assert.strictEqual(typeof client.UVGhostSync, "function");
    assert.strictEqual(typeof client.SelectionGhostSync, "function");
    assert.strictEqual(typeof client.SyncedPixelDocument, "function");
    assert.strictEqual(typeof client.pixelArtDocumentKind, "function");
  });

  test("server entry exports the authoritative server API", () => {
    assert.strictEqual(typeof server.applyCommandToBuffer, "function");
  });
});
