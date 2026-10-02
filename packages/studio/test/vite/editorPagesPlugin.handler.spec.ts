// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Internal Dependencies
import { createEditorPagesHandler } from "../../vite/editorPagesPlugin.ts";
import {
  BUNDLE,
  createDist,
  INDEX_HTML,
  listen,
  PASS_THROUGH_STATUS,
  voxelMapEditor,
  type PagesServer
} from "../helpers/editorPages.ts";
import { removeTempDir } from "../helpers/tempDir.ts";

describe("createEditorPagesHandler", () => {
  let dist: string;
  let server: PagesServer;

  before(async() => {
    dist = await createDist();
    server = await listen(createEditorPagesHandler([voxelMapEditor(dist)]));
  });

  after(async() => {
    await server[Symbol.asyncDispose]();
    await removeTempDir(path.dirname(dist));
  });

  test("serves an editor page at its url", async() => {
    const response = await server.fetch("/editors/voxel-map/?target=map-1");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "text/html; charset=utf-8"
    );
    assert.strictEqual(await response.text(), INDEX_HTML);
  });

  test("redirects a bare editor path to its directory", async() => {
    const response = await server.fetch("/editors/voxel-map?target=map-1");

    assert.strictEqual(response.status, 302);
    assert.strictEqual(
      response.headers.get("location"),
      "/editors/voxel-map/?target=map-1"
    );
  });

  test("serves a bundle as a JavaScript module", async() => {
    const response = await server.fetch("/editors/voxel-map/assets/index.js");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "text/javascript; charset=utf-8"
    );
    assert.strictEqual(await response.text(), BUNDLE);
  });

  test("never serves a file outside the dist folder", async() => {
    for (const [pathname, status] of [
      ["/editors/voxel-map/..%2foutside.txt", 403],
      ["/editors/voxel-map/escape/outside.txt", 404],
      ["/editors/voxel-map/.env", 404]
    ] as const) {
      const response = await server.fetch(pathname);

      assert.strictEqual(response.status, status, pathname);
      assert.notStrictEqual(await response.text(), "secret", pathname);
    }
  });

  test("answers 404 for a missing file or an unknown editor", async() => {
    for (const pathname of [
      "/editors/voxel-map/missing.js",
      "/editors/unknown/",
      "/editors/unknown"
    ]) {
      const response = await server.fetch(pathname);
      await response.text();

      assert.strictEqual(response.status, 404, pathname);
    }
  });

  test("passes other routes and non-GET methods through", async() => {
    for (const [pathname, method] of [
      ["/", "GET"],
      ["/editors/", "GET"],
      ["/assets/index.js", "GET"],
      ["/editors/voxel-map/", "POST"]
    ]) {
      const response = await server.fetch(pathname, { method });
      await response.text();

      assert.strictEqual(
        response.status,
        PASS_THROUGH_STATUS,
        `${method} ${pathname}`
      );
    }
  });
});
