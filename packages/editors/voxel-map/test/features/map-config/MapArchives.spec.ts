// Import Node.js Dependencies
import {
  describe,
  it
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LAST_OPENED_STORAGE_PREFIX,
  type SessionArchive,
  type SessionWorkspace
} from "@jolly-pixel/editor.host";
import type { ImportReport } from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import {
  MapArchives,
  MapImportWithoutRootError
} from "../../../src/features/map-config/MapArchives.ts";

// CONSTANTS
const kAccepts = "voxel-map";

function sessionArchive(
  report: ImportReport,
  canImport = true
): SessionArchive & { exported: (string | undefined)[]; } {
  const exported: (string | undefined)[] = [];

  return {
    canImport,
    exported,
    export: (assetId) => {
      exported.push(assetId);

      return Promise.resolve(new Blob(["zip"]));
    },
    plan: () => Promise.resolve({
      live: [],
      fresh: [],
      sharedDependents: [],
      incompatible: []
    }),
    import: () => Promise.resolve(report)
  };
}

function report(
  rootId?: string
): ImportReport {
  return {
    root: rootId === undefined ?
      undefined :
      { id: rootId, kind: kAccepts },
    created: [],
    replaced: [],
    kept: [],
    failed: []
  };
}

function archives(
  archive: SessionArchive,
  workspace: SessionWorkspace | null = null,
  source = "maps/overworld.voxelmap.json"
): MapArchives {
  return new MapArchives({
    archive,
    workspace,
    accepts: kAccepts,
    target: () => {
      return { id: "map-1", source };
    }
  });
}

describe("MapArchives", () => {
  it("names the download after the map path", async() => {
    const archive = sessionArchive(report());

    const download = await archives(archive).export();

    assert.strictEqual(download.fileName, "overworld.zip");
    assert.deepEqual(archive.exported, ["map-1"]);
    assert.strictEqual(
      archives(archive, null, ".voxelmap").fileName,
      ".voxelmap.zip"
    );
  });

  it("remembers the imported root as last opened", async() => {
    localStorage.clear();

    const imported = await archives(sessionArchive(report("map-2")))
      .import(new Blob([]), "keep");

    assert.strictEqual(imported.root?.id, "map-2");
    assert.strictEqual(
      localStorage.getItem(`${LAST_OPENED_STORAGE_PREFIX}${kAccepts}`),
      "map-2"
    );
  });

  it("rejects an archive without a root to open", async() => {
    await assert.rejects(
      archives(sessionArchive(report())).import(new Blob([]), "keep"),
      MapImportWithoutRootError
    );
  });

  it("builds the reload url onto the imported target", () => {
    const url = archives(sessionArchive(report())).launchUrl(
      "http://localhost:5173/?offline&target=old&max-fps=10",
      "map-2"
    );

    assert.strictEqual(
      new URL(url).searchParams.get("target"),
      "map-2"
    );
    assert.strictEqual(new URL(url).searchParams.has("offline"), true);
    assert.strictEqual(new URL(url).searchParams.get("max-fps"), "10");
  });

  it("reflects what the workspace allows", async() => {
    let resets = 0;
    const persistent: SessionWorkspace = {
      persistent: true,
      reset: () => {
        resets++;

        return Promise.resolve();
      }
    };
    const volatile: SessionWorkspace = {
      persistent: false,
      reset: () => Promise.resolve()
    };
    const archive = sessionArchive(report(), false);

    const server = archives(archive);
    assert.strictEqual(server.canReset, false);
    assert.strictEqual(server.volatile, false);
    assert.strictEqual(server.canImport, false);

    assert.strictEqual(archives(archive, volatile).volatile, true);
    assert.strictEqual(archives(archive, volatile).canReset, false);

    const local = archives(archive, persistent);
    assert.strictEqual(local.canReset, true);
    await local.reset();
    assert.strictEqual(resets, 1);
  });
});
