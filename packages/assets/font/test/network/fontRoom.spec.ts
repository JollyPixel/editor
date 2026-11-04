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
import {
  decodeTypeface,
  fontAssetKind,
  type Typeface
} from "#src/index.ts";
import { fontDocumentKind } from "#src/network/client.ts";
import { blockLetterFont } from "../helpers/fontFiles.ts";

describe("font room", () => {
  test("hands the stored typeface to a joining client", async() => {
    const handler = fontAssetKind();
    const conversion = handler.conversions?.[".ttf"];
    assert.ok(conversion !== undefined);
    const { content } = await conversion(blockLetterFont());
    const server = new LiveAssetRoom(handler);
    handler.load(server.state, content);

    const room = mockAssetRoom<never, Typeface | null>("A");
    const { document } = fontDocumentKind().syncDocument(room);
    await server.connect("A");
    for (const message of server.take<Typeface | null>("A")) {
      room.deliver(message);
    }

    assert.deepEqual(document.typeface, decodeTypeface(content));
  });
});
