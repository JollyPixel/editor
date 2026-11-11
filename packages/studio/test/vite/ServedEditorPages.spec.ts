// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import { createServer } from "vite";
import {
  createDist,
  INDEX_HTML,
  voxelMapEditor
} from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { EditorPageInput } from "../../vite/EditorPageInput.ts";
import { ServedEditorPages } from "../../vite/ServedEditorPages.ts";
import { writeEditorPage } from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

describe("ServedEditorPages", () => {
  test("hands a share page the compiled source page, or the built one", async() => {
    const root = await createTempDir("studio-root-");
    const editor = await createTempDir("studio-editor-page-");
    const dist = await createDist();
    const compiled = voxelMapEditor(dist, {
      page: {
        kind: "source",
        html: await writeEditorPage(editor, "export {};\n")
      }
    });
    const built = voxelMapEditor(dist, {
      name: "built"
    });
    const vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: {
        middlewareMode: true
      }
    });

    try {
      const pages = new ServedEditorPages(
        vite,
        EditorPageInput.compiled(root, [compiled, built])
      );

      const html = await pages.html(compiled);
      assert.match(html, /<script type="module" src="\/@vite\/client">/);
      assert.match(html, /src="\/@fs\/[^"]+\/src\/index\.ts"/);
      assert.strictEqual(await pages.html(built), INDEX_HTML);
    }
    finally {
      await vite.close();
      await removeTempDir(editor);
      await removeTempDir(root);
      await removeTempDir(path.dirname(dist));
    }
  });
});
