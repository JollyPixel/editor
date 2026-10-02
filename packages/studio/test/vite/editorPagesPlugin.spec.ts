// Import Node.js Dependencies
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

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
  let parent: string;
  let mapDist: string;
  let modelDist: string;
  let sent: Array<[string, EditorPageRebuilt]>;
  let warnings: string[];
  let unwatch: () => void;

  const server: EditorPagesServer = {
    config: {
      logger: {
        warn: (message) => warnings.push(message)
      }
    },
    ws: {
      send: (event, payload) => sent.push([event, payload])
    }
  };

  beforeEach(async() => {
    parent = await createTempDir("studio-watch-");
    mapDist = path.join(parent, "voxel-map", "dist");
    modelDist = path.join(parent, "voxel-model", "dist");
    sent = [];
    warnings = [];
    unwatch = watchEditorPages(server, [
      voxelMapEditor(mapDist),
      {
        ...voxelMapEditor(modelDist),
        name: "voxel-model"
      }
    ]);
  });

  afterEach(async() => {
    unwatch();
    await removeTempDir(parent);
  });

  test("announces each rebuilt page once its writes settle", async() => {
    await fs.mkdir(path.join(mapDist, "assets"));
    await fs.writeFile(path.join(mapDist, "assets", "index.js"), BUNDLE);
    await fs.writeFile(path.join(mapDist, "index.html"), INDEX_HTML);
    await fs.writeFile(path.join(modelDist, "index.html"), INDEX_HTML);
    await settle(() => sent.length === 2);

    assert.deepEqual(sent.toSorted(byName), [
      [EDITOR_PAGE_REBUILT_EVENT, { name: "voxel-map" }],
      [EDITOR_PAGE_REBUILT_EVENT, { name: "voxel-model" }]
    ]);
    assert.deepEqual(warnings, []);
  });

  test("keeps watching a folder a build empties and refills", async() => {
    await fs.mkdir(path.join(mapDist, "assets"));
    await fs.writeFile(path.join(mapDist, "assets", "index.js"), BUNDLE);
    await settle(() => sent.length === 1);

    await fs.rm(path.join(mapDist, "assets"), { recursive: true });
    await fs.mkdir(path.join(mapDist, "assets"));
    await fs.writeFile(path.join(mapDist, "assets", "index.js"), BUNDLE);
    await settle(() => sent.length === 2);

    assert.deepEqual(sent.map(([, page]) => page.name), [
      "voxel-map",
      "voxel-map"
    ]);
  });

  test("stops announcing once unwatched", async() => {
    unwatch();
    await fs.writeFile(path.join(mapDist, "index.html"), INDEX_HTML);
    await sleep(EDITOR_PAGE_SETTLE_MS * 2);

    assert.deepEqual(sent, []);
  });
});

async function settle(
  done: () => boolean
): Promise<void> {
  const deadline = Date.now() + (EDITOR_PAGE_SETTLE_MS * 10);
  while (!done() && Date.now() < deadline) {
    await sleep(25);
  }
  await sleep(EDITOR_PAGE_SETTLE_MS * 2);
}

function byName(
  left: [string, EditorPageRebuilt],
  right: [string, EditorPageRebuilt]
): number {
  return left[1].name.localeCompare(right[1].name);
}

describe("editorsModule", () => {
  test("exports the name and kinds of each editor", () => {
    assert.strictEqual(
      editorsModule([voxelMapEditor("/pkg/dist")]),
      "export default [{\"name\":\"voxel-map\",\"kinds\":[\"voxelmap\"]}];\n"
    );
  });
});
