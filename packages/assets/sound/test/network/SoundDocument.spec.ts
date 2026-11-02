// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { encodeContent } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { SoundDocument } from "#src/network/SoundDocument.ts";

describe("SoundDocument", () => {
  test("holds no bytes when the stored content is zero bytes long", () => {
    const document = new SoundDocument();
    document.load(encodeContent(new Uint8Array(0)));

    assert.equal(document.bytes, null);
  });
});
