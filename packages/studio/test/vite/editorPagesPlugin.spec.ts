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
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "../../src/editors/EditorDescriptor.ts";
import {
  EDITOR_PAGE_SETTLE_MS,
  editorPagesPlugin,
  editorsModule,
  EDITORS_MODULE_ID,
  watchEditorPages,
  type EditorPagesServer
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

describe("watchEditorPages", () => {
  const mapDist = path.resolve("pkg", "voxel-map", "dist");
  const modelDist = path.resolve("pkg", "voxel-model", "dist");

  function pagesServer(): EditorPagesServer & {
    watched: string[];
    sent: Array<[string, EditorPageRebuilt]>;
    emit(file: string): void;
  } {
    const listeners: Array<(eventName: string, file: string) => void> = [];
    const watched: string[] = [];
    const sent: Array<[string, EditorPageRebuilt]> = [];

    return {
      watched,
      sent,
      watcher: {
        add: (paths) => watched.push(...paths),
        on: (_event, listener) => listeners.push(listener)
      },
      ws: {
        send: (event, payload) => sent.push([event, payload])
      },
      emit: (file) => {
        for (const listener of listeners) {
          listener("change", file);
        }
      }
    };
  }

  test("announces a rebuilt page once its writes settle", (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const server = pagesServer();
    watchEditorPages(server, [
      voxelMapEditor(mapDist),
      {
        ...voxelMapEditor(modelDist),
        name: "voxel-model"
      }
    ]);

    server.emit(path.join(mapDist, "assets", "index.js"));
    context.mock.timers.tick(EDITOR_PAGE_SETTLE_MS - 1);
    server.emit(path.join(mapDist, "index.html"));
    server.emit(path.join(modelDist, "index.html"));
    server.emit(path.resolve("pkg", "voxel-map", "src", "index.ts"));
    context.mock.timers.tick(EDITOR_PAGE_SETTLE_MS);

    assert.deepEqual(server.watched, [mapDist, modelDist]);
    assert.deepEqual(server.sent, [
      [EDITOR_PAGE_REBUILT_EVENT, { name: "voxel-map" }],
      [EDITOR_PAGE_REBUILT_EVENT, { name: "voxel-model" }]
    ]);
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
