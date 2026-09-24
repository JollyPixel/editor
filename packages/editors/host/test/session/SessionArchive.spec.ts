// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ARCHIVE_MIME_TYPE,
  type ImportPlan,
  type ImportReport
} from "@jolly-pixel/asset-server/catalog/client";
import { BINARY_KIND } from "@jolly-pixel/asset-server/backend";
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  CatalogSessionArchive,
  type ArchiveCatalog
} from "#src/session/SessionArchive.ts";
import { ArchiveImportDisabledError } from "#src/session/errors/ArchiveImportDisabledError.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { EditorSession } from "#src/session/EditorSession.ts";
import { OfflineWorkspace } from "#src/workspace/offline/OfflineWorkspace.ts";

// CONSTANTS
const kPlan: ImportPlan = {
  live: [],
  fresh: [],
  sharedDependents: [],
  incompatible: []
};
const kReport: ImportReport = {
  created: [],
  replaced: [],
  kept: [],
  failed: []
};

interface RecordingCatalog extends ArchiveCatalog {
  readonly calls: unknown[][];
}

function recordingCatalog(): RecordingCatalog {
  const calls: unknown[][] = [];

  return {
    calls,
    exportArchive: (root) => {
      calls.push(["export", root]);

      return Promise.resolve(new Uint8Array([1, 2, 3]));
    },
    planImport: (archive) => {
      calls.push(["plan", [...archive]]);

      return Promise.resolve(kPlan);
    },
    importArchive: (archive, options) => {
      calls.push(["import", [...archive], options.onConflict]);

      return Promise.resolve(kReport);
    }
  };
}

describe("CatalogSessionArchive", () => {
  test("exports the catalog archive as a zip blob", async() => {
    const catalog = recordingCatalog();
    const archive = new CatalogSessionArchive({ catalog, canImport: true });

    const blob = await archive.export("map");

    assert.strictEqual(blob.type, ARCHIVE_MIME_TYPE);
    assert.deepEqual(
      [...new Uint8Array(await blob.arrayBuffer())],
      [1, 2, 3]
    );
    assert.deepEqual(catalog.calls, [["export", "map"]]);
  });

  test("plans and imports the bytes of a file", async() => {
    const catalog = recordingCatalog();
    const archive = new CatalogSessionArchive({ catalog, canImport: true });
    const file = new Blob([new Uint8Array([9, 8])]);

    assert.strictEqual(await archive.plan(file), kPlan);
    assert.strictEqual(
      await archive.import(file, { onConflict: "replace" }),
      kReport
    );
    assert.deepEqual(catalog.calls, [
      ["plan", [9, 8]],
      ["import", [9, 8], "replace"]
    ]);
  });

  test("refuses to import when the workspace does not persist", async() => {
    const catalog = recordingCatalog();
    const archive = new CatalogSessionArchive({ catalog, canImport: false });

    await assert.rejects(
      archive.import(new Blob([]), { onConflict: "keep" }),
      ArchiveImportDisabledError
    );
    assert.deepEqual(catalog.calls, []);
  });
});

describe("EditorSession archive port", () => {
  test("a memory-backed offline session exports but cannot import", async() => {
    const workspace = await OfflineWorkspace.open({
      handlers: [],
      seed: {
        "notes/readme.bin": {
          id: "readme",
          kind: BINARY_KIND,
          content: () => new TextEncoder().encode("hello")
        }
      }
    });
    const session = await EditorSession.connect({
      ...workspace.connect(),
      launch: new EditorLaunch(new AssetId("readme")),
      accepts: BINARY_KIND,
      kinds: []
    });

    assert.strictEqual(session.workspace, workspace);
    assert.strictEqual(session.archive.canImport, false);

    const blob = await session.archive.export("readme");
    const plan = await session.archive.plan(blob);
    assert.deepEqual(plan.live, [
      { id: "readme", kind: BINARY_KIND, path: "notes/readme.bin" }
    ]);

    session.dispose();
    await workspace.close();
  });
});
