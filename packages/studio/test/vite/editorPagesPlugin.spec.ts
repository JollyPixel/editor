// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  build,
  createServer
} from "vite";

// Import Internal Dependencies
import { editorPagesPlugin } from "../../vite/editorPagesPlugin.ts";
import {
  BUNDLE,
  createDist,
  INDEX_HTML,
  listen,
  voxelMapPages
} from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

describe("editorPagesPlugin", () => {
  let dist: string;
  let root: string;

  before(async() => {
    dist = await createDist();
    root = await createTempDir("studio-root-");
    await fs.writeFile(
      path.join(root, "index.html"),
      "<script type=\"module\" src=\"./main.ts\"></script>"
    );
    await fs.writeFile(
      path.join(root, "main.ts"),
      "document.title = \"studio\";\n"
    );
  });

  after(async() => {
    await removeTempDir(path.dirname(dist));
    await removeTempDir(root);
  });

  test("serves the editor pages on the dev server", async() => {
    const vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: {
        middlewareMode: true
      },
      plugins: [editorPagesPlugin(voxelMapPages(dist))]
    });
    await using server = await listen(vite.middlewares);

    try {
      const response = await server.fetch("/editors/voxel-map/");

      assert.strictEqual(response.status, 200);
      assert.strictEqual(await response.text(), INDEX_HTML);
    }
    finally {
      await vite.close();
    }
  });

  test("copies the pages on build", async() => {
    const outDir = path.join(root, "out");
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [editorPagesPlugin(voxelMapPages(dist))]
    });

    assert.strictEqual(
      await fs.readFile(
        path.join(outDir, "editors", "voxel-map", "index.html"),
        "utf8"
      ),
      INDEX_HTML
    );
    assert.strictEqual(
      await fs.readFile(
        path.join(outDir, "editors", "voxel-map", "assets", "index.js"),
        "utf8"
      ),
      BUNDLE
    );
  });
});
