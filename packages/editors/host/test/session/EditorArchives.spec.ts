// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ImportConflictPolicy,
  ImportPlan,
  ImportReport
} from "@jolly-pixel/asset-server/client";
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  EditorArchives,
  type EditorArchiveBrowser,
  type EditorArchiveTarget
} from "#src/session/EditorArchives.ts";
import { ArchiveRootError } from "#src/session/errors/ArchiveRootError.ts";
import type {
  SessionArchive,
  SessionArchiveImportOptions
} from "#src/session/SessionArchive.ts";
import type { SessionWorkspace } from "#src/workspace/SessionWorkspace.ts";
import { LAST_OPENED_STORAGE_PREFIX } from "#src/launch/sources/LastOpenedLaunchSource.ts";

// CONSTANTS
const kKind = "voxelmodel";
const kResetWarning = "Everything is deleted.";
const kRoot: AssetReferenceData = {
  id: "model-2",
  kind: kKind
};
const kLiveEntry = {
  ...kRoot,
  path: "models/robot.voxelmodel.json"
};

Object.assign(globalThis, {
  localStorage: window.localStorage
});

interface FakeArchive extends SessionArchive {
  exported: Array<string | undefined>;
  imported: SessionArchiveImportOptions[];
}

interface FakeArchiveOptions {
  canImport?: boolean;
  root?: AssetReferenceData;
  live?: ImportPlan["live"];
}

interface FakeBrowser extends EditorArchiveBrowser {
  saved: Array<{ fileName: string; text: Promise<string>; }>;
  asked: ImportPlan[];
  confirmed: string[];
  assigned: string[];
  reloads: number;
}

interface FakeBrowserOptions {
  policy?: ImportConflictPolicy | null;
  confirm?: boolean;
}

function createArchive(
  options: FakeArchiveOptions = {}
): FakeArchive {
  const {
    canImport = true,
    live = []
  } = options;
  const root = "root" in options ? options.root : kRoot;

  const exported: Array<string | undefined> = [];
  const imported: SessionArchiveImportOptions[] = [];

  return {
    canImport,
    exported,
    imported,
    export(assetId) {
      exported.push(assetId);

      return Promise.resolve(new Blob(["zip"]));
    },
    plan() {
      const plan: ImportPlan = {
        root,
        live,
        fresh: [],
        sharedDependents: [],
        incompatible: []
      };

      return Promise.resolve(plan);
    },
    import(_file, importOptions) {
      imported.push(importOptions);
      const report: ImportReport = {
        root,
        created: [],
        replaced: [],
        kept: [],
        failed: []
      };

      return Promise.resolve(report);
    }
  };
}

function createBrowser(
  options: FakeBrowserOptions = {}
): FakeBrowser {
  const {
    policy = "replace",
    confirm = true
  } = options;

  const browser: FakeBrowser = {
    saved: [],
    asked: [],
    confirmed: [],
    assigned: [],
    reloads: 0,
    location: {
      href: "http://localhost:5173/?target=model-1&room=a",
      assign(url) {
        browser.assigned.push(String(url));
      },
      reload() {
        browser.reloads++;
      }
    },
    save(blob, fileName) {
      browser.saved.push({
        fileName,
        text: blob.text()
      });
    },
    askConflictPolicy(plan) {
      browser.asked.push(plan);

      return Promise.resolve(policy);
    },
    confirmReset(message) {
      browser.confirmed.push(message);

      return Promise.resolve(confirm);
    }
  };

  return browser;
}

interface CreateArchivesOptions {
  archive?: SessionArchive;
  browser?: EditorArchiveBrowser;
  workspace?: SessionWorkspace | null;
  target?: EditorArchiveTarget;
}

function createArchives(
  options: CreateArchivesOptions = {}
): EditorArchives {
  const {
    archive = createArchive(),
    browser = createBrowser(),
    workspace = null,
    target = {
      id: "model-1",
      source: "models/robot.voxelmodel.json"
    }
  } = options;

  return new EditorArchives({
    archive,
    workspace,
    accepts: kKind,
    fallbackName: "model",
    resetWarning: kResetWarning,
    target: () => target,
    browser
  });
}

function createWorkspace(
  overrides: Partial<SessionWorkspace> = {}
): SessionWorkspace & { resets: number; } {
  const workspace = {
    persistent: true,
    resets: 0,
    reset() {
      workspace.resets++;

      return Promise.resolve();
    },
    ...overrides
  };

  return workspace;
}

describe("EditorArchives", () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe("download", () => {
    test("saves the target archive under its file stem", async() => {
      const archive = createArchive();
      const browser = createBrowser();
      const archives = createArchives({ archive, browser });

      await archives.download();

      assert.deepEqual(archive.exported, ["model-1"]);
      assert.equal(browser.saved.length, 1);
      assert.equal(browser.saved[0].fileName, "robot.zip");
      assert.equal(await browser.saved[0].text, "zip");
    });

    test("falls back to the given name when the source has no stem", async() => {
      const browser = createBrowser();
      const archives = createArchives({
        browser,
        target: {
          id: "model-1",
          source: "models/"
        }
      });

      await archives.download();

      assert.equal(browser.saved[0].fileName, "model.zip");
    });
  });

  describe("importFile", () => {
    test("imports without asking when nothing exists, then opens the root", async() => {
      const archive = createArchive();
      const browser = createBrowser();
      const archives = createArchives({ archive, browser });

      await archives.importFile(new Blob());

      assert.deepEqual(browser.asked, []);
      assert.deepEqual(archive.imported, [{ onConflict: "keep" }]);
      assert.deepEqual(browser.assigned, [
        "http://localhost:5173/?target=model-2&room=a"
      ]);
      assert.equal(
        localStorage.getItem(`${LAST_OPENED_STORAGE_PREFIX}${kKind}`),
        kRoot.id
      );
    });

    test("asks how to handle existing assets and imports with the answer", async() => {
      const archive = createArchive({ live: [kLiveEntry] });
      const browser = createBrowser({ policy: "copy" });
      const archives = createArchives({ archive, browser });

      await archives.importFile(new Blob());

      assert.equal(browser.asked.length, 1);
      assert.deepEqual(archive.imported, [{ onConflict: "copy" }]);
      assert.equal(browser.assigned.length, 1);
    });

    test("does nothing when the question is dismissed", async() => {
      const archive = createArchive({ live: [kLiveEntry] });
      const browser = createBrowser({ policy: null });
      const archives = createArchives({ archive, browser });

      await archives.importFile(new Blob());

      assert.deepEqual(archive.imported, []);
      assert.deepEqual(browser.assigned, []);
    });

    test("refuses an archive rooted on another kind before importing", async() => {
      const archive = createArchive({
        root: { id: "texture-1", kind: "pixelart" }
      });
      const archives = createArchives({ archive });

      await assert.rejects(archives.importFile(new Blob()), ArchiveRootError);
      assert.deepEqual(archive.imported, []);
    });

    test("refuses a whole-workspace archive before importing", async() => {
      const archive = createArchive({ root: undefined });
      const archives = createArchives({ archive });

      await assert.rejects(archives.importFile(new Blob()), ArchiveRootError);
      assert.deepEqual(archive.imported, []);
    });
  });

  describe("reset", () => {
    test("resets the workspace and reloads once the warning is confirmed", async() => {
      const browser = createBrowser();
      const workspace = createWorkspace();
      const archives = createArchives({ browser, workspace });

      await archives.reset();

      assert.deepEqual(browser.confirmed, [kResetWarning]);
      assert.equal(workspace.resets, 1);
      assert.equal(browser.reloads, 1);
    });

    test("does nothing when the warning is declined", async() => {
      const browser = createBrowser({ confirm: false });
      const workspace = createWorkspace();
      const archives = createArchives({ browser, workspace });

      await archives.reset();

      assert.equal(workspace.resets, 0);
      assert.equal(browser.reloads, 0);
    });
  });

  describe("capabilities", () => {
    test("reflects the import capability of the session archive", () => {
      const archives = createArchives({
        archive: createArchive({ canImport: false })
      });

      assert.equal(archives.canImport, false);
    });

    test("offers reset only for a persistent resettable workspace", () => {
      const archives = createArchives({ workspace: createWorkspace() });
      const locked = createArchives({
        workspace: createWorkspace({ canReset: false })
      });

      assert.equal(archives.canReset, true);
      assert.equal(archives.volatile, false);
      assert.equal(locked.canReset, false);
    });

    test("flags a volatile workspace", () => {
      const archives = createArchives({
        workspace: createWorkspace({ persistent: false })
      });

      assert.equal(archives.volatile, true);
      assert.equal(archives.canReset, false);
    });

    test("has nothing to reset without a workspace", () => {
      const archives = createArchives();

      assert.equal(archives.canReset, false);
      assert.equal(archives.volatile, false);
    });
  });
});
