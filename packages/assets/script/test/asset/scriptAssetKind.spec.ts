// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetKindRegistry,
  InvalidAssetFileError
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  ASSET_KINDS,
  SCRIPT_KIND,
  SCRIPT_TEMPLATE,
  TEXT_KIND,
  scriptAssetKind,
  textAssetKind
} from "#src/index.ts";

describe("ASSET_KINDS", () => {
  test("resolves code to the script kind and other text files to the text kind", () => {
    const registry = new AssetKindRegistry(ASSET_KINDS.handlers({}));
    const cases: Array<[string, string]> = [
      ["scripts/Player.ts", SCRIPT_KIND],
      ["scripts/legacy.js", SCRIPT_KIND],
      ["README.md", TEXT_KIND],
      ["config/game.json", TEXT_KIND],
      ["config/ci.yml", TEXT_KIND],
      ["ui/menu.html", TEXT_KIND]
    ];

    for (const [path, kind] of cases) {
      assert.equal(registry.resolve(path).kind, kind, path);
    }
  });
});

describe("textAssetKind", () => {
  test("a new text file starts empty", async() => {
    const handler = textAssetKind();
    const content = await handler.serialize(handler.create("new"));

    assert.equal(content.byteLength, 0);
  });
});

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
