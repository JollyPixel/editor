// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetInlineContent } from "@jolly-pixel/asset-server";
import {
  LiveAssetRoom,
  mockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import { modelAssetKind } from "#src/index.ts";
import { modelFileDocumentKind } from "#src/network/client.ts";

// CONSTANTS
const kGlbContent = new Uint8Array([0x67, 0x6C, 0x54, 0x46, 2, 0, 0, 0]);

describe("model room", () => {
  test("hands the stored model file to a joining client", async() => {
    const handler = modelAssetKind();
    const server = new LiveAssetRoom(handler);
    handler.load(server.state, kGlbContent);

    const room = mockAssetRoom<never, AssetInlineContent>("A");
    const { document } = modelFileDocumentKind().syncDocument(room);
    assert.equal(document.bytes, null);
    await server.connect("A");
    for (const message of server.take<AssetInlineContent>("A")) {
      room.deliver(message);
    }

    assert.deepEqual(document.bytes, kGlbContent);
  });
});
