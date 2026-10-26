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
  decodeContent,
  encodeContent,
  foldAssetEvent,
  textureAssetKind,
  TEXTURE_KIND,
  type AssetInlineContent
} from "#src/index.ts";
import { LiveAssetRoom } from "#src/testing/index.ts";
import {
  bytes,
  text
} from "../../../helpers/bytes.ts";
import { assetEvent } from "../../../helpers/events.ts";

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
      "a.bmp",
      "a.ktx2"
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

  test("declares the content type of each image extension", () => {
    assert.strictEqual(textureAssetKind().extensions[".jpg"], "image/jpeg");
    assert.strictEqual(textureAssetKind().extensions[".ktx2"], "image/ktx2");
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

  test("sends its current bytes as the room snapshot", () => {
    const handler = textureAssetKind();
    const room = new LiveAssetRoom(handler);
    handler.load(room.state, bytes("first"));

    room.connect("A");
    handler.load(room.state, bytes("second"));
    room.extension.reload();

    const snapshots = room.take<AssetInlineContent>("A").map((message) => {
      assert.strictEqual(message.type, "snapshot");

      return text(decodeContent(message.data));
    });
    assert.deepStrictEqual(snapshots, ["first", "second"]);
  });
});
