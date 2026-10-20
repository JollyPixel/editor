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
} from "@jolly-pixel/asset-server/client";
import { BINARY_KIND } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  CatalogSessionArchive,
  type ArchiveCatalog
} from "#src/session/SessionArchive.ts";
import { ArchiveImportDisabledError } from "#src/session/errors/ArchiveImportDisabledError.ts";
import { SessionConnection } from "#src/session/SessionConnection.ts";
import { OfflineServer } from "#src/offline/server/OfflineServer.ts";

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

  test("refuses to import when the offline data does not persist", async() => {
    const catalog = recordingCatalog();
    const archive = new CatalogSessionArchive({ catalog, canImport: false });

    await assert.rejects(
      archive.import(new Blob([]), { onConflict: "keep" }),
      ArchiveImportDisabledError
    );
    assert.deepEqual(catalog.calls, []);
  });
});

describe("SessionConnection archive port", () => {
  test("a memory-backed offline connection exports but cannot import", async() => {
    const server = await OfflineServer.open({
      handlers: [],
      seed: {
        "notes/readme.bin": {
          id: "readme",
          kind: BINARY_KIND,
          content: () => new TextEncoder().encode("hello")
        }
      }
    });
    const connection = await SessionConnection.connect(server.connect());

    assert.strictEqual(connection.offline, server);
    assert.strictEqual(connection.archive.canImport, false);

    const blob = await connection.archive.export("readme");
    const plan = await connection.archive.plan(blob);
    assert.deepEqual(plan.live, [
      { id: "readme", kind: BINARY_KIND, path: "notes/readme.bin" }
    ]);

    connection.dispose();
    await server.close();
  });
});
