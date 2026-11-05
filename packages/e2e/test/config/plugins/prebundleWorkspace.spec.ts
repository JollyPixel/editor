// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  describe,
  it
} from "node:test";

// Import Third-party Dependencies
import {
  createServer,
  resolveConfig,
  type Plugin,
  type ViteDevServer
} from "vite";

// Import Internal Dependencies
import { prebundleWorkspace } from "../../../src/config/plugins/prebundleWorkspace.ts";
import {
  EDITOR_ENTRY,
  EDITOR_PAGE_ENTRY,
  EXPECTED_ENTRIES,
  FIXTURE_ROOT,
  VIRTUAL_MODULES
} from "../../helpers/workspaceFixture.ts";

// CONSTANTS
const kKeptEntry = "@jolly-pixel/kept";

function fixtureVirtualModules(): Plugin {
  return {
    name: "fixture-virtual-modules",
    resolveId(source) {
      return Object.hasOwn(VIRTUAL_MODULES, source) ? `\0${source}` : null;
    },
    load(id) {
      return id.startsWith("\0") ? VIRTUAL_MODULES[id.slice(1)] ?? null : null;
    }
  };
}

interface FixtureServer extends AsyncDisposable {
  server: ViteDevServer;
}

async function fixtureServer(
  mode: string,
  entries?: string[]
): Promise<FixtureServer> {
  const cacheDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "jolly-e2e-prebundle-")
  );
  const server = await createServer({
    configFile: false,
    root: FIXTURE_ROOT,
    cacheDir,
    mode,
    logLevel: "silent",
    server: {
      middlewareMode: true,
      ws: false
    },
    resolve: {
      alias: [
        {
          find: /^@jolly-pixel\/.*$/,
          replacement: path.posix.join(FIXTURE_ROOT, "package.js")
        }
      ]
    },
    optimizeDeps: {
      include: [kKeptEntry],
      noDiscovery: true,
      entries
    },
    plugins: [
      fixtureVirtualModules(),
      prebundleWorkspace()
    ]
  }).catch(async(error: unknown) => {
    await fs.rm(cacheDir, { recursive: true, force: true });

    throw error;
  });

  return {
    server,
    async [Symbol.asyncDispose]() {
      await server.close();
      await fs.rm(cacheDir, { recursive: true, force: true });
    }
  };
}

describe("prebundleWorkspace", () => {
  it("pre-bundles the scope entries of the page in every serve mode", async() => {
    await using fixture = await fixtureServer("development");
    const { include, force } = fixture.server.environments.client.config.optimizeDeps;

    assert.deepEqual(include, [kKeptEntry, ...EXPECTED_ENTRIES]);
    assert.strictEqual(force, true);
  });

  it("pre-bundles the scope entries of every page the optimizer scans", async() => {
    await using fixture = await fixtureServer(
      "e2e",
      ["index.html", EDITOR_PAGE_ENTRY]
    );
    const { include } = fixture.server.environments.client.config.optimizeDeps;

    assert.deepEqual(
      include,
      [kKeptEntry, ...[EDITOR_ENTRY, ...EXPECTED_ENTRIES].sort()]
    );
  });

  it("rejects a glob entry it cannot scan as a page", async() => {
    await assert.rejects(
      fixtureServer("e2e", ["**/*.html"]),
      /"\*\*\/\*\.html" is a glob/
    );
  });

  it("hands the entries to the dependency optimizer before it starts", async() => {
    await using fixture = await fixtureServer("e2e");
    const { depsOptimizer } = fixture.server.environments.client;
    assert.ok(depsOptimizer);

    await depsOptimizer.init();

    assert.deepEqual(
      Object.keys(depsOptimizer.metadata.optimized).sort(),
      [kKeptEntry, ...EXPECTED_ENTRIES].sort()
    );
  });

  it("leaves builds alone", async() => {
    const config = await resolveConfig(
      {
        configFile: false,
        root: FIXTURE_ROOT,
        logLevel: "silent",
        optimizeDeps: {
          include: [kKeptEntry]
        },
        plugins: [
          prebundleWorkspace()
        ]
      },
      "build"
    );

    assert.deepEqual(config.optimizeDeps.include, [kKeptEntry]);
    assert.notStrictEqual(config.optimizeDeps.force, true);
  });
});
