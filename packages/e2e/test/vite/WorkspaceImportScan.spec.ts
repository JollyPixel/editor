// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  WorkspaceImportScan,
  type ModuleSource
} from "../../src/vite/WorkspaceImportScan.ts";
import {
  EXPECTED_ENTRIES,
  FIXTURE_PAGE,
  FIXTURE_ROOT,
  HANDLERS_MODULE,
  MAIN_MODULE,
  VIRTUAL_MODULES
} from "../helpers/workspaceFixture.ts";

function fixtureModules(
  loaded: string[]
): ModuleSource {
  return {
    async resolve(specifier, importer) {
      if (specifier.startsWith("virtual:")) {
        return `\0${specifier}`;
      }
      if (specifier.startsWith("/")) {
        return path.posix.join(FIXTURE_ROOT, specifier);
      }
      if (specifier.startsWith(".")) {
        return path.posix.join(path.posix.dirname(importer), specifier);
      }

      return `${FIXTURE_ROOT}/node_modules/${specifier}/index.js`;
    },
    async load(id) {
      loaded.push(id);

      return id.startsWith("\0") ?
        VIRTUAL_MODULES[id.slice(1)] ?? null :
        fs.readFile(id, "utf8");
    }
  };
}

describe("WorkspaceImportScan", () => {
  it("collects the scope entries a page loads at runtime", async() => {
    const scan = new WorkspaceImportScan({
      modules: fixtureModules([]),
      scope: "@jolly-pixel/"
    });

    await scan.scanPage(FIXTURE_PAGE);

    assert.deepEqual(scan.entries, EXPECTED_ENTRIES);
  });

  it("loads each module once and skips node_modules", async() => {
    const loaded: string[] = [];
    const scan = new WorkspaceImportScan({
      modules: fixtureModules(loaded),
      scope: "@jolly-pixel/"
    });

    await scan.scanPage(FIXTURE_PAGE);
    await scan.scanPage(FIXTURE_PAGE);

    assert.deepEqual(loaded, [
      FIXTURE_PAGE,
      `\0${MAIN_MODULE}`,
      `${FIXTURE_ROOT}/feature.js`,
      `\0${HANDLERS_MODULE}`
    ]);
  });
});
