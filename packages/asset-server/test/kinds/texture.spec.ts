// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  AssetKindRegistry,
  encodeContent,
  textureAssetHandler,
  TEXTURE_KIND
} from "#src/index.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import { assetEvent } from "../helpers/events.ts";

describe("textureAssetHandler", () => {
  test("claims the common image extensions", () => {
    const registry = new AssetKindRegistry([textureAssetHandler()]);

    for (const path of [
      "a.png",
      "textures/grass.png",
      "textures/nested/deep.jpg",
      "a.jpeg",
      "a.webp",
      "a.gif",
      "a.bmp"
    ]) {
      assert.strictEqual(
        registry.resolve(path).kind,
        TEXTURE_KIND,
        `expected "${path}" to resolve to ${TEXTURE_KIND}`
      );
    }
  });

  test("leaves other paths to the binary fallback", () => {
    const registry = new AssetKindRegistry([textureAssetHandler()]);

    assert.strictEqual(registry.resolve("a.txt").kind, "binary");
    assert.strictEqual(registry.resolve("a.png.bak").kind, "binary");
  });

  test("honours a custom match list", () => {
    const registry = new AssetKindRegistry([
      textureAssetHandler({ match: ["textures/**/*.png"] })
    ]);

    assert.strictEqual(registry.resolve("textures/a.png").kind, TEXTURE_KIND);
    assert.strictEqual(registry.resolve("sprites/a.png").kind, "binary");
  });

  test("stores the bytes verbatim", async() => {
    const handler = textureAssetHandler();
    const state = handler.create("a1");

    handler.apply(state, assetEvent(ASSET_CREATED, {
      path: "a.png",
      kind: TEXTURE_KIND,
      hash: "h1",
      size: 5,
      content: encodeContent(bytes("hello"))
    }));

    assert.strictEqual(text(await handler.serialize(state)), "hello");
  });

  test("has no editing room", () => {
    assert.strictEqual(textureAssetHandler().createExtension, undefined);
  });
});
