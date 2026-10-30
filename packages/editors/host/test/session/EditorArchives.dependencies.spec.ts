// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { ArchiveRootError } from "#src/session/errors/ArchiveRootError.ts";
import { ArchiveImportDisabledError } from "#src/session/errors/ArchiveImportDisabledError.ts";
import type { EditorArchives } from "#src/session/EditorArchives.ts";
import {
  DEPENDENCY_KIND,
  DEPENDENCY_ROOT,
  FakeArchiveCatalog,
  TARGET_ID,
  archiveFile,
  createArchive,
  createArchives,
  createBrowser
} from "../helpers/session/archives.ts";
import { FakeNavigator } from "../helpers/session/catalog.ts";

// CONSTANTS
const kDependencyEntry = {
  ...DEPENDENCY_ROOT,
  path: "animations/walk.voxelanim.json"
};

function acceptAnimations(
  archives: EditorArchives
): AssetReferenceData[] {
  const linked: AssetReferenceData[] = [];
  archives.acceptDependency(DEPENDENCY_KIND, (reference) => {
    linked.push(reference);
  });

  return linked;
}

function animationFile(
  name: string
): File {
  return new File(["{}"], name);
}

describe("EditorArchives dependencies", () => {
  describe("dependencies", () => {
    test("lists the target's direct dependencies the catalog knows", () => {
      const catalog = new FakeArchiveCatalog([kDependencyEntry]);
      catalog.dependencies.set(TARGET_ID, [
        DEPENDENCY_ROOT,
        { id: "gone", kind: DEPENDENCY_KIND.kind }
      ]);
      const archives = createArchives({ catalog });

      assert.deepEqual(archives.dependencies, [kDependencyEntry]);
    });

    test("saves a dependency archive under its own file stem", async() => {
      const archive = createArchive();
      const browser = createBrowser();
      const archives = createArchives({
        archive,
        browser,
        catalog: new FakeArchiveCatalog([kDependencyEntry])
      });

      await archives.downloadAsset(DEPENDENCY_ROOT.id);

      assert.deepEqual(archive.exported, [DEPENDENCY_ROOT.id]);
      assert.equal(browser.saved[0].fileName, "walk.zip");
    });
  });

  describe("importFile", () => {
    test("creates a file of an accepted format in its folder and links it", async() => {
      const catalog = new FakeArchiveCatalog();
      const archives = createArchives({ catalog });
      const linked = acceptAnimations(archives);

      await archives.importFile(animationFile("run.voxelanim.json"));

      assert.deepEqual(catalog.created, [
        {
          path: "animations/run.voxelanim.json",
          text: "{}",
          options: {
            kind: DEPENDENCY_KIND.kind,
            onConflict: "suffix"
          }
        }
      ]);
      assert.deepEqual(linked, [
        {
          id: "created-1",
          kind: DEPENDENCY_KIND.kind
        }
      ]);
    });

    test("links an archive rooted on an accepted dependency instead of switching", async() => {
      const archive = createArchive({ root: DEPENDENCY_ROOT });
      const browser = createBrowser();
      const navigator = new FakeNavigator();
      const archives = createArchives({ archive, browser, navigator });
      const linked = acceptAnimations(archives);

      await archives.importFile(archiveFile(), DEPENDENCY_KIND.kind);

      assert.deepEqual(archive.imported, [{ onConflict: "keep" }]);
      assert.deepEqual(linked, [DEPENDENCY_ROOT]);
      assert.deepEqual(navigator.navigations, []);
      assert.equal(browser.reloads, 0);
    });

    test("refuses an archive rooted on another kind than the one asked before importing", async() => {
      const archive = createArchive();
      const archives = createArchives({ archive });
      acceptAnimations(archives);

      await assert.rejects(
        archives.importFile(archiveFile(), DEPENDENCY_KIND.kind),
        ArchiveRootError
      );
      assert.deepEqual(archive.imported, []);
    });

    test("reads a file of a released format as an archive", async() => {
      const archive = createArchive({ root: DEPENDENCY_ROOT });
      const catalog = new FakeArchiveCatalog();
      const archives = createArchives({ archive, catalog });
      const release = archives.acceptDependency(DEPENDENCY_KIND, () => undefined);
      release();

      await assert.rejects(
        archives.importFile(animationFile("run.voxelanim.json")),
        ArchiveRootError
      );
      assert.deepEqual(catalog.created, []);
      assert.deepEqual(archive.imported, []);
    });

    test("reloads without linking again when it replaced a dependency in use", async() => {
      const archive = createArchive({
        root: DEPENDENCY_ROOT,
        live: [kDependencyEntry],
        replaced: [kDependencyEntry]
      });
      const browser = createBrowser({ policy: "replace" });
      const catalog = new FakeArchiveCatalog([kDependencyEntry]);
      catalog.dependencies.set(TARGET_ID, [DEPENDENCY_ROOT]);
      const archives = createArchives({ archive, browser, catalog });
      const linked = acceptAnimations(archives);

      await archives.importFile(archiveFile());

      assert.deepEqual(archive.imported, [{ onConflict: "replace" }]);
      assert.deepEqual(linked, []);
      assert.equal(browser.reloads, 1);
    });

    test("links without reloading when the replaced assets are not in use", async() => {
      const archive = createArchive({
        root: DEPENDENCY_ROOT,
        live: [kDependencyEntry],
        replaced: [kDependencyEntry]
      });
      const browser = createBrowser({ policy: "replace" });
      const archives = createArchives({ archive, browser });
      const linked = acceptAnimations(archives);

      await archives.importFile(archiveFile());

      assert.deepEqual(linked, [DEPENDENCY_ROOT]);
      assert.equal(browser.reloads, 0);
    });

    test("refuses when importing is disabled", async() => {
      const archive = createArchive({
        canImport: false,
        root: DEPENDENCY_ROOT
      });
      const catalog = new FakeArchiveCatalog();
      const archives = createArchives({ archive, catalog });
      acceptAnimations(archives);

      await assert.rejects(
        archives.importFile(animationFile("run.voxelanim.json")),
        ArchiveImportDisabledError
      );
      await assert.rejects(
        archives.importFile(archiveFile()),
        ArchiveImportDisabledError
      );
      assert.deepEqual(catalog.created, []);
      assert.deepEqual(archive.imported, []);
    });
  });

  describe("pickAndImport", () => {
    test("picks an archive or a file of the asked kind, then imports it", async() => {
      const catalog = new FakeArchiveCatalog();
      const browser = createBrowser({ picked: animationFile("run.voxelanim.json") });
      const archives = createArchives({ browser, catalog });
      const linked = acceptAnimations(archives);

      await archives.pickAndImport(DEPENDENCY_KIND.kind);

      assert.deepEqual(browser.picks, [".zip,application/zip,.json"]);
      assert.equal(linked.length, 1);
    });
  });
});
