// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ArchiveRootError } from "#src/session/errors/ArchiveRootError.ts";
import { ArchiveImportDisabledError } from "#src/session/errors/ArchiveImportDisabledError.ts";
import {
  ARCHIVE_ROOT,
  LIVE_ENTRY,
  RESET_WARNING,
  archiveFile,
  createArchive,
  createArchives,
  createBrowser,
  createOfflineMode
} from "../helpers/session/archives.ts";
import { FakeNavigator } from "../helpers/session/catalog.ts";

describe("EditorArchives", () => {
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

    test("falls back to the given name when the path has no stem", async() => {
      const browser = createBrowser();
      const archives = createArchives({
        browser,
        target: {
          id: "model-1",
          path: "models/"
        }
      });

      await archives.download();

      assert.equal(browser.saved[0].fileName, "model.zip");
    });
  });

  describe("importFile", () => {
    test("imports without asking when nothing exists, then switches to the root", async() => {
      const archive = createArchive();
      const browser = createBrowser();
      const navigator = new FakeNavigator();
      const archives = createArchives({ archive, browser, navigator });

      await archives.importFile(archiveFile());

      assert.deepEqual(browser.asked, []);
      assert.deepEqual(archive.imported, [{ onConflict: "keep" }]);
      assert.deepEqual(navigator.navigations, [
        {
          target: ARCHIVE_ROOT.id,
          tag: null
        }
      ]);
      assert.deepEqual(browser.assigned, []);
    });

    test("reloads onto the root when the import replaced assets", async() => {
      const archive = createArchive({
        live: [LIVE_ENTRY],
        replaced: [LIVE_ENTRY]
      });
      const browser = createBrowser();
      const navigator = new FakeNavigator();
      const archives = createArchives({ archive, browser, navigator });

      await archives.importFile(archiveFile());

      assert.deepEqual(archive.imported, [{ onConflict: "replace" }]);
      assert.deepEqual(navigator.navigations, []);
      assert.deepEqual(browser.assigned, [
        "http://localhost:5173/?target=model-2&room=a"
      ]);
    });

    test("asks how to handle existing assets and imports with the answer", async() => {
      const archive = createArchive({ live: [LIVE_ENTRY] });
      const browser = createBrowser({ policy: "copy" });
      const navigator = new FakeNavigator();
      const archives = createArchives({ archive, browser, navigator });

      await archives.importFile(archiveFile());

      assert.equal(browser.asked.length, 1);
      assert.deepEqual(archive.imported, [{ onConflict: "copy" }]);
      assert.equal(navigator.navigations.length, 1);
    });

    test("does nothing when the question is dismissed", async() => {
      const archive = createArchive({ live: [LIVE_ENTRY] });
      const browser = createBrowser({ policy: null });
      const navigator = new FakeNavigator();
      const archives = createArchives({ archive, browser, navigator });

      await archives.importFile(archiveFile());

      assert.deepEqual(archive.imported, []);
      assert.deepEqual(navigator.navigations, []);
      assert.deepEqual(browser.assigned, []);
    });

    test("refuses an archive rooted on another kind before importing", async() => {
      const archive = createArchive({
        root: { id: "texture-1", kind: "pixelart" }
      });
      const archives = createArchives({ archive });

      await assert.rejects(archives.importFile(archiveFile()), ArchiveRootError);
      assert.deepEqual(archive.imported, []);
    });

    test("refuses an archive without a root before importing", async() => {
      const archive = createArchive({ root: undefined });
      const archives = createArchives({ archive });

      await assert.rejects(archives.importFile(archiveFile()), ArchiveRootError);
      assert.deepEqual(archive.imported, []);
    });
  });

  describe("pickAndImport", () => {
    test("imports the picked archive, then switches to the root", async() => {
      const archive = createArchive();
      const browser = createBrowser();
      const navigator = new FakeNavigator();
      const archives = createArchives({ archive, browser, navigator });

      await archives.pickAndImport();

      assert.deepEqual(browser.picks, [".zip,application/zip"]);
      assert.deepEqual(archive.imported, [{ onConflict: "keep" }]);
      assert.deepEqual(navigator.navigations, [
        {
          target: ARCHIVE_ROOT.id,
          tag: null
        }
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
      assert.deepEqual(browser.picks, []);
    });
  });

  describe("reset", () => {
    test("resets the offline data and reloads once the warning is confirmed", async() => {
      const browser = createBrowser();
      const offline = createOfflineMode();
      const archives = createArchives({ browser, offline });

      await archives.reset();

      assert.deepEqual(browser.confirmed, [RESET_WARNING]);
      assert.equal(offline.resets, 1);
      assert.equal(browser.reloads, 1);
    });

    test("does nothing when the warning is declined", async() => {
      const browser = createBrowser({ confirm: false });
      const offline = createOfflineMode();
      const archives = createArchives({ browser, offline });

      await archives.reset();

      assert.equal(offline.resets, 0);
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

    test("offers reset only for persistent resettable offline data", () => {
      const archives = createArchives({ offline: createOfflineMode() });
      const locked = createArchives({
        offline: createOfflineMode({ canReset: false })
      });

      assert.equal(archives.canReset, true);
      assert.equal(locked.canReset, false);
    });

    test("has nothing to reset on volatile offline data", () => {
      const archives = createArchives({
        offline: createOfflineMode({ persistent: false })
      });

      assert.equal(archives.canReset, false);
    });

    test("has nothing to reset outside offline mode", () => {
      const archives = createArchives();

      assert.equal(archives.canReset, false);
    });
  });
});
