// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import * as client from "#src/network/client.ts";
import * as server from "#src/network/server.ts";

describe("network entry points", () => {
  test("client entry exports every browser sync helper", () => {
    assert.strictEqual(typeof client.PixelSyncClient, "function");
    assert.strictEqual(typeof client.PixelCursorSync, "function");
    assert.strictEqual(typeof client.PixelStrokeGhostSync, "function");
    assert.strictEqual(typeof client.UVGhostSync, "function");
    assert.strictEqual(typeof client.SelectionGhostSync, "function");
  });

  test("server entry exports the authoritative server API", () => {
    assert.strictEqual(typeof server.PixelSyncServer, "function");
    assert.strictEqual(typeof server.applyCommandToBuffer, "function");
  });
});
