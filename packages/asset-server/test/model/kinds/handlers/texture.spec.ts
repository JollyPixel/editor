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
  foldAssetEvent,
  textureAssetKind,
  TEXTURE_KIND
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
      content: { type: "inline", data: bytes("hello") }
    }));

    assert.strictEqual(text(await handler.serialize(state)), "hello");
  });

  test("sends its current bytes as the room snapshot", async() => {
    const handler = textureAssetKind();
    const room = new LiveAssetRoom(handler);
    handler.load(room.state, bytes("first"));

    await room.connect("A");
    handler.load(room.state, bytes("second"));
    await room.extension.reload();

    const snapshots = room.take<Uint8Array>("A").map((message) => {
      assert.strictEqual(message.type, "snapshot");

      return text(message.data);
    });
    assert.deepStrictEqual(snapshots, ["first", "second"]);
  });

  test("previews the stored bytes of an image a browser shows", async() => {
    const handler = textureAssetKind();
    const images: readonly (readonly [string, readonly number[]])[] = [
      ["image/png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0]],
      ["image/jpeg", [0xFF, 0xD8, 0xFF, 0xE0]],
      ["image/gif", [...bytes("GIF89a")]],
      ["image/webp", [...bytes("RIFF"), 1, 2, 3, 4, ...bytes("WEBPVP8 ")]],
      ["image/bmp", [...bytes("BM"), 0, 0]]
    ];

    for (const [type, content] of images) {
      const state = handler.create("a1");
      handler.load(state, new Uint8Array(content));

      const preview = await handler.preview!(state);

      assert.strictEqual(preview?.type, type);
      assert.deepStrictEqual(preview.bytes, state.bytes);
    }
  });

  test("has no preview for ktx2 or for an image over 2 MiB", async() => {
    const handler = textureAssetKind();
    const ktx2 = handler.create("a1");
    handler.load(ktx2, new Uint8Array([0xAB, ...bytes("KTX 20"), 0xBB]));
    const large = handler.create("a2");
    const png = new Uint8Array(2 * 1024 * 1024 + 1);
    png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    handler.load(large, png);

    assert.strictEqual(await handler.preview!(ktx2), null);
    assert.strictEqual(await handler.preview!(large), null);
  });
});
