// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// Import Internal Dependencies
import {
  EDITOR_PAGE_REBUILT_EVENT,
  type EditorPageRebuilt
} from "../../src/editors/EditorDescriptor.ts";
import {
  EDITOR_PAGE_SETTLE_MS,
  watchEditorPages,
  type EditorPagesServer
} from "../../vite/watchEditorPages.ts";
import {
  BUNDLE,
  INDEX_HTML,
  voxelMapEditor
} from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kBuiltAt = new Date("2026-01-01T00:00:00.000Z");
const kReadAt = new Date("2026-01-01T02:00:00.000Z");

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

  test("ignores reads that only touch the access time", async() => {
    const index = path.join(mapDist, "index.html");
    await fs.writeFile(index, INDEX_HTML);
    await fs.utimes(index, kBuiltAt, kBuiltAt);
    await settle(() => sent.length === 1);

    await fs.utimes(index, kReadAt, kBuiltAt);
    await sleep(EDITOR_PAGE_SETTLE_MS * 2);

    assert.deepEqual(sent.map(([, page]) => page.name), [
      "voxel-map"
    ]);
  });

  test("ignores files the page already had when watching started", async() => {
    unwatch();
    const index = path.join(mapDist, "index.html");
    await fs.writeFile(index, INDEX_HTML);
    await fs.utimes(index, kBuiltAt, kBuiltAt);
    unwatch = watchEditorPages(server, [voxelMapEditor(mapDist)]);

    await fs.utimes(index, kReadAt, kBuiltAt);
    await sleep(EDITOR_PAGE_SETTLE_MS * 2);

    assert.deepEqual(sent, []);
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
