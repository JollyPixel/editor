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
import {
  editorPagesPlugin,
  editorsModule,
  EDITORS_MODULE_ID
} from "../../vite/editorPagesPlugin.ts";
import {
  BUNDLE,
  createDist,
  INDEX_HTML,
  listen,
  voxelMapEditor
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
      `import editors from "${EDITORS_MODULE_ID}";\n` +
      "document.title = JSON.stringify(editors);\n"
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
      plugins: [editorPagesPlugin([voxelMapEditor(dist)])]
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

  test("bundles the descriptors and copies the pages on build", async() => {
    const outDir = path.join(root, "out");
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [editorPagesPlugin([voxelMapEditor(dist)])]
    });

    const assets = await fs.readdir(path.join(outDir, "assets"));
    const bundle = await fs.readFile(
      path.join(outDir, "assets", assets[0]),
      "utf8"
    );
    assert.match(bundle, /voxel-map/);
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

describe("editorsModule", () => {
  test("exports the name and kinds of each editor", () => {
    assert.strictEqual(
      editorsModule([voxelMapEditor("/pkg/dist")]),
      "export default [{\"name\":\"voxel-map\",\"kinds\":[\"voxelmap\"]}];\n"
    );
  });
});
