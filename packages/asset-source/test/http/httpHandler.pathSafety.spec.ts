// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AssetPathEscapeError,
  MemoryAssetSource,
  STATE_DIRECTORY
} from "#src/index.ts";
import {
  createAssetStaticHandler,
  FilesystemAssetSource
} from "#src/node.ts";
import { bytes } from "../helpers/bytes.ts";
import { send } from "../helpers/http.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

function workspace(): MemoryAssetSource {
  return new MemoryAssetSource([
    ["textures/block.png", bytes("png-bytes")],
    ["maps/overworld.voxelmap.json", bytes("{}")],
    ["notes.unknown", bytes("raw")],
    [`${STATE_DIRECTORY}/state.json`, bytes("{}")]
  ]);
}

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

  test("answers 403 for a Windows reserved segment", async() => {
    const handler = createAssetStaticHandler({ source: workspace() });

    for (const url of [
      "/assets/con.png",
      "/assets/textures/block.png::$DATA",
      "/assets/textures/block.png."
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
    await using temp = await tempWorkspace();
    const source = new FilesystemAssetSource(temp.root);
    await source.createFolder("textures");

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
