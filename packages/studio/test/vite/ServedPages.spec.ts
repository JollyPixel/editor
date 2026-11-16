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
import {
  createDist,
  INDEX_HTML,
  voxelMapEditor
} from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { PageInput } from "../../vite/PageInput.ts";
import { ServedPages } from "../../vite/ServedPages.ts";
import { writeEditorPage } from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

function createViteServer(
  root: string
) {
  return createServer({
    root,
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    server: {
      middlewareMode: true
    }
  });
}

describe("ServedPages", () => {
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
    const vite = await createViteServer(root);

    try {
      const pages = new ServedPages(
        vite,
        PageInput.editors(root, [compiled, built])
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

  test("renders a shell page from pages/ with root URLs for the files it loads", async() => {
    const root = await createTempDir("studio-root-");
    await fs.mkdir(path.join(root, "pages"));
    await fs.writeFile(
      path.join(root, "pages", "play.html"),
      "<link rel=\"stylesheet\" href=\"../main.css\">" +
      "<script type=\"module\" src=\"../src/play/index.ts\"></script>"
    );
    const vite = await createViteServer(root);

    try {
      const pages = new ServedPages(vite, [PageInput.shell(root, "play")]);

      const html = await pages.render("play");
      assert.match(html, /href="\/main\.css"/);
      assert.match(html, /src="\/src\/play\/index\.ts"/);
      await assert.rejects(pages.render("preview"), /"\/preview\/"/);
    }
    finally {
      await vite.close();
      await removeTempDir(root);
    }
  });
});
