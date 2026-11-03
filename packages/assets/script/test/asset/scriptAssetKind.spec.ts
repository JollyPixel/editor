// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  SCRIPT_TEMPLATE,
  scriptAssetKind
} from "#src/index.ts";

describe("scriptAssetKind", () => {
  test("a new script starts from the behavior template", async() => {
    const handler = scriptAssetKind();
    const content = await handler.serialize(handler.create("new"));

    assert.equal(new TextDecoder().decode(content), SCRIPT_TEMPLATE);
  });

  test("loads a file with Windows line endings as LF text", () => {
    const handler = scriptAssetKind();
    const state = handler.create("a");

    handler.load(state, new TextEncoder().encode("a\r\nb\r\n"));

    assert.equal(state.text, "a\nb\n");
  });

  test("refuses content that is not UTF-8", () => {
    const handler = scriptAssetKind();

    assert.throws(
      () => handler.load(handler.create("a"), new Uint8Array([0xff, 0xfe, 0x00])),
      InvalidAssetFileError
    );
  });
});
