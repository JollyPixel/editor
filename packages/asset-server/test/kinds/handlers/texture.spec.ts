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
  foldAssetEvent,
  textureAssetKind,
  TEXTURE_KIND
} from "#src/index.ts";
import {
  bytes,
  text
} from "../../helpers/bytes.ts";
import { assetEvent } from "../../helpers/events.ts";

describe("textureAssetKind", () => {
  test("claims the common image extensions", () => {
    const registry = new AssetKindRegistry([textureAssetKind()]);

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
    const registry = new AssetKindRegistry([textureAssetKind()]);

    assert.strictEqual(registry.resolve("a.txt").kind, "binary");
    assert.strictEqual(registry.resolve("a.png.bak").kind, "binary");
  });

  test("honours a custom match list", () => {
    const registry = new AssetKindRegistry([
      textureAssetKind({ match: ["textures/**/*.png"] })
    ]);

    assert.strictEqual(registry.resolve("textures/a.png").kind, TEXTURE_KIND);
    assert.strictEqual(registry.resolve("sprites/a.png").kind, "binary");
  });

  test("match never widens past the image extensions", () => {
    const registry = new AssetKindRegistry([
      textureAssetKind({ match: ["textures/**"] })
    ]);

    assert.strictEqual(registry.resolve("textures/a.png").kind, TEXTURE_KIND);
    assert.strictEqual(registry.resolve("textures/a.txt").kind, "binary");
  });

  test("declares the content type of each image extension", () => {
    assert.strictEqual(textureAssetKind().extensions[".jpg"], "image/jpeg");
  });

  test("stores the bytes verbatim", async() => {
    const handler = textureAssetKind();
    const state = handler.create("a1");

    foldAssetEvent(handler, state, assetEvent(ASSET_CREATED, {
      path: "a.png",
      kind: TEXTURE_KIND,
      hash: "h1",
      size: 5,
      content: encodeContent(bytes("hello"))
    }));

    assert.strictEqual(text(await handler.serialize(state)), "hello");
  });

  test("has no editing room", () => {
    assert.strictEqual(textureAssetKind().commands, undefined);
  });
});
