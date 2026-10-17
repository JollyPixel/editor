// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ArchiveRootError } from "#src/session/errors/ArchiveRootError.ts";
import { ArchiveImportDisabledError } from "#src/session/errors/ArchiveImportDisabledError.ts";
import { LAST_OPENED_STORAGE_PREFIX } from "#src/launch/sources/LastOpenedLaunchSource.ts";
import {
  ARCHIVE_KIND,
  ARCHIVE_ROOT,
  LIVE_ENTRY,
  RESET_WARNING,
  createArchive,
  createArchives,
  createBrowser,
  createWorkspace
} from "../helpers/session/archives.ts";

Object.assign(globalThis, {
  localStorage: window.localStorage
});

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
        localStorage.getItem(`${LAST_OPENED_STORAGE_PREFIX}${ARCHIVE_KIND}`),
        ARCHIVE_ROOT.id
      );
    });

    test("asks how to handle existing assets and imports with the answer", async() => {
      const archive = createArchive({ live: [LIVE_ENTRY] });
      const browser = createBrowser({ policy: "copy" });
      const archives = createArchives({ archive, browser });

      await archives.importFile(new Blob());

      assert.equal(browser.asked.length, 1);
      assert.deepEqual(archive.imported, [{ onConflict: "copy" }]);
      assert.equal(browser.assigned.length, 1);
    });

    test("does nothing when the question is dismissed", async() => {
      const archive = createArchive({ live: [LIVE_ENTRY] });
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

  describe("pickAndImport", () => {
    test("imports the picked archive, then opens the root", async() => {
      const archive = createArchive();
      const browser = createBrowser();
      const archives = createArchives({ archive, browser });

      await archives.pickAndImport();

      assert.equal(browser.picks, 1);
      assert.deepEqual(archive.imported, [{ onConflict: "keep" }]);
      assert.deepEqual(browser.assigned, [
        "http://localhost:5173/?target=model-2&room=a"
      ]);
    });

    test("does nothing when the pick is cancelled", async() => {
      const archive = createArchive();
      const browser = createBrowser({ picked: null });
      const archives = createArchives({ archive, browser });

      await archives.pickAndImport();

      assert.deepEqual(archive.imported, []);
      assert.deepEqual(browser.assigned, []);
    });

    test("refuses before opening the picker when importing is disabled", async() => {
      const browser = createBrowser();
      const archives = createArchives({
        archive: createArchive({ canImport: false }),
        browser
      });

      await assert.rejects(
        archives.pickAndImport(),
        ArchiveImportDisabledError
      );
      assert.equal(browser.picks, 0);
    });
  });

  describe("reset", () => {
    test("resets the workspace and reloads once the warning is confirmed", async() => {
      const browser = createBrowser();
      const workspace = createWorkspace();
      const archives = createArchives({ browser, workspace });

      await archives.reset();

      assert.deepEqual(browser.confirmed, [RESET_WARNING]);
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
