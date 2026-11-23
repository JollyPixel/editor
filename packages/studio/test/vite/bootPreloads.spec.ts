// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { build } from "vite";

// Import Internal Dependencies
import { bootPreloads } from "../../vite/bootPreloads.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kPage = "<script type=\"module\" src=\"./main.ts\"></script>";
const kEditorPage = "editors/scene/index.html";

describe("bootPreloads", () => {
  let root: string;

  before(async() => {
    root = await createTempDir("studio-preloads-");
    await fs.mkdir(path.join(root, "editors/scene"), { recursive: true });
    await fs.writeFile(path.join(root, "index.html"), kPage);
    await fs.writeFile(path.join(root, kEditorPage), kPage.replace(
      "./main.ts",
      "../../main.ts"
    ));
    await fs.writeFile(path.join(root, "main.ts"), "export {};\n");
  });

  after(async() => {
    await removeTempDir(root);
  });

  async function buildPages(
    mode: string
  ): Promise<{ shell: string; editor: string; }> {
    const outDir = path.join(root, mode);
    await build({
      root,
      mode,
      base: "./",
      configFile: false,
      logLevel: "silent",
      build: {
        outDir,
        rollupOptions: {
          input: [
            path.join(root, "index.html"),
            path.join(root, kEditorPage)
          ]
        }
      },
      plugins: [bootPreloads()]
    });

    return {
      shell: await fs.readFile(path.join(outDir, "index.html"), "utf8"),
      editor: await fs.readFile(path.join(outDir, kEditorPage), "utf8")
    };
  }

  function preloads(
    html: string
  ): string[] {
    return Array.from(
      html.matchAll(/<link rel="preload" href="([^"]+)" as="fetch"/g),
      ([, href]) => href
    );
  }

  test("preloads the manifest and the session on the shell page only", async() => {
    const { shell, editor } = await buildPages("production");

    assert.deepEqual(preloads(shell), [
      "./project-manifest.json",
      "./api/accounts/me"
    ]);
    assert.deepEqual(preloads(editor), []);
  });

  test("preloads no session in the static build, which has no server", async() => {
    const { shell } = await buildPages("static");

    assert.deepEqual(preloads(shell), ["./project-manifest.json"]);
  });
});
