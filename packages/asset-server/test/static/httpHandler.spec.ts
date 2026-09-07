// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetKindRegistry,
  AssetPathEscapeError,
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

describe("createAssetStaticHandler — path safety", () => {
  test("answers 404 for the state directory whatever the case", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    for (const url of [
      `/assets/${STATE_DIRECTORY}/state.json`,
      "/assets/.JOLLYPIXEL/state.json",
      "/assets/.JollyPixel/events.db"
    ]) {
      const result = await send(handler, { url });

      assert.strictEqual(result.statusCode, 404, url);
    }
  });

  test("answers 404 for a path the source ignores", async() => {
    const source = Object.assign(
      new MemoryAssetSource([[".git/config", bytes("secret")]]),
      { isIgnored: (path: string) => path.startsWith(".git/") }
    );

    const handler = createAssetStaticHandler({ source });
    const result = await send(handler, { url: "/assets/.git/config" });

    assert.strictEqual(result.statusCode, 404);
  });

  test("answers 403 for an absolute or drive-qualified path", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    for (const url of [
      "/assets//etc/passwd",
      "/assets/%2Fetc%2Fpasswd",
      "/assets/C%3A%2FWindows%2Fwin.ini",
      "/assets/%5C%5Cserver%5Cshare%5Ca.png"
    ]) {
      const result = await send(handler, { url });

      assert.strictEqual(result.statusCode, 403, url);
    }
  });

  test("answers 400 for a control character in the path", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, {
      url: "/assets/textures/block.png%00.txt"
    });

    assert.strictEqual(result.statusCode, 400);
  });

  test("answers 404 for a directory request", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    for (const url of [
      "/assets/textures/",
      "/assets/."
    ]) {
      const result = await send(handler, { url });

      assert.strictEqual(result.statusCode, 404, url);
    }
  });

  test("answers 403 when the source refuses the resolved path", async() => {
    const source = new MemoryAssetSource();
    source.read = () => Promise.reject(
      new AssetPathEscapeError("link/secret.txt")
    );

    const handler = createAssetStaticHandler({ source });
    const result = await send(handler, { url: "/assets/link/secret.txt" });

    assert.strictEqual(result.statusCode, 403);
  });

  test("answers 404 when the target turns out to be a directory", async() => {
    const source = new MemoryAssetSource();
    source.read = () => Promise.reject(
      Object.assign(new Error("EISDIR"), { code: "EISDIR" })
    );

    const handler = createAssetStaticHandler({ source });
    const result = await send(handler, { url: "/assets/textures" });

    assert.strictEqual(result.statusCode, 404);
  });

  test("ignores the fragment", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    const result = await send(handler, {
      url: "/assets/textures/block.png#anchor"
    });

    assert.strictEqual(result.statusCode, 200);
  });
});
