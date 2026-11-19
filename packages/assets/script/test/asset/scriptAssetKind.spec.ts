// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { AssetPath } from "@jolly-pixel/asset";
import {
  AssetKindRegistry,
  InvalidAssetFileError
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  ASSET_KINDS,
  SCRIPT_KIND,
  SHADER_KIND,
  TEXT_KIND,
  scriptAssetKind,
  textAssetKind
} from "#src/index.ts";

describe("ASSET_KINDS", () => {
  test("resolves TSL files to shaders, other code to scripts and other text files to text", () => {
    const registry = new AssetKindRegistry(ASSET_KINDS.handlers({}));
    const cases: Array<[string, string]> = [
      ["scripts/Player.ts", SCRIPT_KIND],
      ["scripts/legacy.js", SCRIPT_KIND],
      ["shaders/Water.tsl.ts", SHADER_KIND],
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
  test("a new script declares a behavior named after its file", () => {
    const handler = scriptAssetKind();
    const cases: Array<[string, string]> = [
      ["scripts/player.ts", "PlayerBehavior"],
      ["scripts/enemy-spawner.ts", "EnemySpawnerBehavior"],
      ["scripts/New script-2.ts", "NewScript2Behavior"],
      ["scripts/PlayerBehavior.ts", "PlayerBehavior"],
      ["scripts/behavior.ts", "NewBehavior"],
      ["scripts/2d camera.js", "_2dCameraBehavior"],
      ["scripts/élan.ts", "ÉlanBehavior"]
    ];

    for (const [path, behavior] of cases) {
      const state = handler.create("new", new AssetPath(path));

      assert.ok(
        state.text.includes(`export class ${behavior} extends Behavior {`),
        path
      );
    }
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
