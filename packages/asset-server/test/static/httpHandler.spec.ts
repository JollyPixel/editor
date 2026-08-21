// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  createAssetStaticHandler,
  MemoryAssetSource,
  STATE_DIRECTORY,
  textureAssetHandler
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { send } from "../helpers/http.ts";

function workspace(): MemoryAssetSource {
  return new MemoryAssetSource([
    ["textures/block.png", bytes("png-bytes")],
    ["maps/overworld.voxelmap.json", bytes("{}")],
    ["notes.unknown", bytes("raw")],
    [`${STATE_DIRECTORY}/state.json`, bytes("{}")]
  ]);
}

describe("createAssetStaticHandler", () => {
  test("serves a workspace file under the default prefix", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, { url: "/assets/textures/block.png" });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.headers["content-type"], "image/png");
    assert.strictEqual(result.headers["content-length"], "9");
    assert.strictEqual(result.body?.toString(), "png-bytes");
  });

  test("passes a request outside the prefix to next()", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, { url: "/index.html" });

    assert.strictEqual(result.nexted, true);
  });

  test("accepts a prefix without a trailing slash", async() => {
    const handler = createAssetStaticHandler({
      source: workspace(),
      prefix: "/w"
    });

    const result = await send(handler, { url: "/w/notes.unknown" });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(
      result.headers["content-type"],
      "application/octet-stream"
    );
  });

  test("takes content types from the registered kinds", async() => {
    const handler = createAssetStaticHandler({
      source: workspace(),
      kinds: new AssetKindRegistry([
        {
          ...textureAssetHandler({ match: ["**/*.png"] }),
          contentTypes: { ".png": "image/png-custom" }
        }
      ])
    });

    const result = await send(handler, { url: "/assets/textures/block.png" });

    assert.strictEqual(result.headers["content-type"], "image/png-custom");
  });

  test("lets an explicit table override the kinds", async() => {
    const handler = createAssetStaticHandler({
      source: workspace(),
      kinds: new AssetKindRegistry([textureAssetHandler()]),
      contentTypes: { ".png": "image/override" }
    });

    const result = await send(handler, { url: "/assets/textures/block.png" });

    assert.strictEqual(result.headers["content-type"], "image/override");
  });

  test("ignores the query string", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, {
      url: "/assets/textures/block.png?v=2"
    });

    assert.strictEqual(result.statusCode, 200);
  });

  test("decodes percent-encoded segments", async() => {
    const handler = createAssetStaticHandler({
      source: new MemoryAssetSource([["my textures/a.png", bytes("x")]])
    });

    const result = await send(handler, {
      url: "/assets/my%20textures/a.png"
    });

    assert.strictEqual(result.statusCode, 200);
  });

  test("answers HEAD with the headers and no body", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, {
      method: "HEAD",
      url: "/assets/textures/block.png"
    });

    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.headers["content-length"], "9");
    assert.strictEqual(result.body, null);
  });

  test("rejects a write method with 405", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, {
      method: "POST",
      url: "/assets/textures/block.png"
    });

    assert.strictEqual(result.statusCode, 405);
    assert.strictEqual(result.headers.allow, "GET, HEAD");
  });

  test("answers 404 for a missing file", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, { url: "/assets/nope.png" });

    assert.strictEqual(result.statusCode, 404);
  });

  test("answers 404 for the state directory", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, {
      url: `/assets/${STATE_DIRECTORY}/state.json`
    });

    assert.strictEqual(result.statusCode, 404);
  });

  test("answers 404 for the prefix itself", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, { url: "/assets/" });

    assert.strictEqual(result.statusCode, 404);
  });

  test("answers 403 for a path escaping the workspace", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    for (const url of [
      "/assets/../secret.txt",
      "/assets/%2e%2e/secret.txt",
      "/assets/textures/../../secret.txt"
    ]) {
      const result = await send(handler, { url });

      assert.strictEqual(result.statusCode, 403, url);
    }
  });

  test("answers 400 for a malformed escape sequence", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, { url: "/assets/%zz.png" });

    assert.strictEqual(result.statusCode, 400);
  });

  test("answers 500 when the source fails for another reason", async() => {
    const source = new MemoryAssetSource();
    source.read = () => Promise.reject(new Error("disk on fire"));

    const handler = createAssetStaticHandler({ source });
    const result = await send(handler, { url: "/assets/a.png" });

    assert.strictEqual(result.statusCode, 500);
  });
});
