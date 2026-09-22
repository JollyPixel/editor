// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ARCHIVE_MIME_TYPE,
  ArchiveImportDisabledError,
  CatalogSessionArchive,
  type ArchiveCatalog
} from "#src/catalog/client/index.ts";
import type {
  ImportPlan,
  ImportReport
} from "#src/archive/AssetArchive.ts";

// CONSTANTS
const kPlan: ImportPlan = {
  live: [],
  fresh: [],
  sharedDependents: []
};
const kReport: ImportReport = {
  created: [],
  replaced: [],
  kept: [],
  failed: []
};

describe("CatalogSessionArchive", () => {
  test("converts archive bytes to a zip blob", async() => {
    const calls: Array<string | undefined> = [];
    const catalog: ArchiveCatalog = {
      exportArchive: (root) => {
        calls.push(root);

        return Promise.resolve(new Uint8Array([1, 2, 3]));
      },
      planImport: () => Promise.resolve(kPlan),
      importArchive: () => Promise.resolve(kReport)
    };
    const archive = new CatalogSessionArchive({ catalog, canImport: true });
    const blob = await archive.export("map");

    assert.strictEqual(blob.type, ARCHIVE_MIME_TYPE);
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2, 3]);
    assert.deepEqual(calls, ["map"]);
  });

  test("passes file bytes and conflict policy to the catalog", async() => {
    const calls: unknown[][] = [];
    const catalog: ArchiveCatalog = {
      exportArchive: () => Promise.resolve(new Uint8Array()),
      planImport: (bytes) => {
        calls.push(["plan", [...bytes]]);

        return Promise.resolve(kPlan);
      },
      importArchive: (bytes, options) => {
        calls.push(["import", [...bytes], options.onConflict]);

        return Promise.resolve(kReport);
      }
    };
    const archive = new CatalogSessionArchive({ catalog, canImport: true });
    const file = new Blob([new Uint8Array([9, 8])]);

    assert.strictEqual(await archive.plan(file), kPlan);
    assert.strictEqual(
      await archive.import(file, { onConflict: "replace" }),
      kReport
    );
    assert.deepEqual(calls, [
      ["plan", [9, 8]],
      ["import", [9, 8], "replace"]
    ]);
  });

  test("disables import before calling the catalog", async() => {
    const catalog: ArchiveCatalog = {
      exportArchive: () => Promise.resolve(new Uint8Array()),
      planImport: () => Promise.resolve(kPlan),
      importArchive: () => {
        assert.fail("importArchive must not be called");
      }
    };
    const archive = new CatalogSessionArchive({ catalog, canImport: false });

    await assert.rejects(
      archive.import(new Blob([]), { onConflict: "keep" }),
      ArchiveImportDisabledError
    );
  });
});
