// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import {
  assetSourceUrl,
  ASSET_URL_PREFIX,
  CATALOG_URL_PATH
} from "../src/index.ts";

describe("urls", () => {
  test("exposes the routes both sides agree on", () => {
    assert.strictEqual(CATALOG_URL_PATH, "/__jollypixel/catalog");
    assert.strictEqual(ASSET_URL_PREFIX, "/assets/");
  });

  describe("assetSourceUrl", () => {
    test("joins a workspace-relative source to the default prefix", () => {
      assert.strictEqual(
        assetSourceUrl("textures/block.pixelart"),
        "/assets/textures/block.pixelart"
      );
    });

    test("encodes each segment without encoding the separators", () => {
      assert.strictEqual(
        assetSourceUrl("my textures/a&b.png"),
        "/assets/my%20textures/a%26b.png"
      );
    });

    test("accepts a prefix with or without a trailing slash", () => {
      assert.strictEqual(assetSourceUrl("a.png", "/w"), "/w/a.png");
      assert.strictEqual(assetSourceUrl("a.png", "/w/"), "/w/a.png");
    });

    test("drops empty segments", () => {
      assert.strictEqual(assetSourceUrl("/a//b.png"), "/assets/a/b.png");
    });
  });
});
