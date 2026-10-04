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
  type Plugin,
  type ViteDevServer
} from "vite";

// Import Internal Dependencies
import { prebundleWorkspace } from "../../src/vite/prebundleWorkspace.ts";
import {
  EXPECTED_ENTRIES,
  FIXTURE_ROOT,
  VIRTUAL_MODULES
} from "../helpers/workspaceFixture.ts";

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
  mode: string
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
      noDiscovery: true
    },
    plugins: [
      fixtureVirtualModules(),
      prebundleWorkspace()
    ]
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
  it("pre-bundles the scope entries of the page in e2e mode", async() => {
    await using fixture = await fixtureServer("e2e");
    const { include, force } = fixture.server.environments.client.config.optimizeDeps;

    assert.deepEqual(include, [kKeptEntry, ...EXPECTED_ENTRIES]);
    assert.strictEqual(force, true);
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

  it("leaves other modes alone", async() => {
    await using fixture = await fixtureServer("development");
    const { include, force } = fixture.server.environments.client.config.optimizeDeps;

    assert.deepEqual(include, [kKeptEntry]);
    assert.notStrictEqual(force, true);
  });
});
