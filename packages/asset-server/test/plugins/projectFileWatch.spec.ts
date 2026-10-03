// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { createServer } from "vite";

// Import Internal Dependencies
import {
  createProjectFileWatchPlugin,
  ProjectFile
} from "#src/node.ts";
import { tempWorkspace } from "../helpers/tempWorkspace.ts";

describe("createProjectFileWatchPlugin", () => {
  test("restarts the server when the project file changes", async() => {
    await using workspace = await tempWorkspace();
    const projectFile = await ProjectFile.readOrCreate(workspace.root, {
      version: 1
    });
    const vite = await createServer({
      root: workspace.root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: {
        middlewareMode: true,
        watch: null
      },
      plugins: [createProjectFileWatchPlugin(projectFile)]
    });
    let restarts = 0;
    const { promise: restarted, resolve } = Promise.withResolvers<void>();
    vite.restart = async() => {
      restarts++;
      resolve();
    };
    const checks: Promise<boolean>[] = [];
    const isStale = projectFile.isStale.bind(projectFile);
    projectFile.isStale = () => {
      const check = isStale();
      checks.push(check);

      return check;
    };

    try {
      vite.watcher.emit("change", projectFile.path);
      assert.strictEqual(checks.length, 1);
      assert.strictEqual(await checks[0], false);

      await fs.writeFile(projectFile.path, "{\"version\":1,\"editors\":[]}");
      vite.watcher.emit("change", path.join(workspace.root, "other.json"));
      assert.strictEqual(checks.length, 1);

      vite.watcher.emit("change", projectFile.path);
      assert.strictEqual(await checks[1], true);
      await restarted;

      assert.strictEqual(restarts, 1);
    }
    finally {
      await vite.close();
    }
  });
});
