// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LiveAssetRoom,
  mockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import { soundAssetKind } from "#src/index.ts";
import { soundDocumentKind } from "#src/network/client.ts";

// CONSTANTS
const kOggContent = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0, 2, 7, 9]);

describe("sound room", () => {
  test("hands the stored Ogg bytes to a joining client", async() => {
    const handler = soundAssetKind();
    const server = new LiveAssetRoom(handler);
    handler.load(server.state, kOggContent);

    const room = mockAssetRoom<never, Uint8Array>("A");
    const { document } = soundDocumentKind().syncDocument(room);
    assert.equal(document.bytes, null);
    await server.connect("A");
    for (const message of server.take<Uint8Array>("A")) {
      room.deliver(message);
    }

    assert.deepEqual(document.bytes, kOggContent);
  });
});
