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
import {
  build,
  createServer
} from "vite";

// Import Internal Dependencies
import type { EditorPages } from "../../server/editors/EditorPages.ts";
import { editorPages } from "../../vite/editorPages.ts";
import {
  BUNDLE,
  createDist,
  INDEX_HTML,
  listen,
  voxelMapPages
} from "../helpers/editorPages.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kEditorCss = "body { margin: 0; }";
const kScriptUrl = /(?:src|href)="([^"]+\.js)"/g;
const kBundledStylesheet = /href="\.\.\/\.\.\/assets\/[^"]+\.css"/;

async function readScripts(
  page: string
): Promise<string[]> {
  const html = await fs.readFile(page, "utf8");

  return Array.from(
    html.matchAll(kScriptUrl),
    ([, url]) => path.resolve(path.dirname(page), url)
  );
}

describe("editorPages", () => {
  let dist: string;
  let root: string;

  before(async() => {
    dist = await createDist();
    root = await createTempDir("studio-root-");
    await fs.writeFile(
      path.join(root, "index.html"),
      "<script type=\"module\" src=\"./main.ts\"></script>"
    );
    await fs.writeFile(
      path.join(root, "main.ts"),
      "import { mount } from \"./shared.ts\";\nmount(\"studio\");\n"
    );
    await fs.writeFile(
      path.join(root, "shared.ts"),
      "export function mount(name: string) {\n  document.title = name;\n}\n"
    );
  });

  after(async() => {
    await removeTempDir(path.dirname(dist));
    await removeTempDir(root);
  });

  test("serves the editor pages on the dev server", async() => {
    const vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: {
        middlewareMode: true
      },
      plugins: [editorPages(voxelMapPages(dist))]
    });
    await using server = await listen(vite.middlewares);

    try {
      const response = await server.fetch("/editors/voxel-map/");

      assert.strictEqual(response.status, 200);
      assert.strictEqual(await response.text(), INDEX_HTML);
    }
    finally {
      await vite.close();
    }
  });

  function buildStudio(
    pages: EditorPages,
    outDir: string
  ) {
    return build({
      root,
      base: "./",
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [editorPages(pages)]
    });
  }

  test("compiles an editor page with the shell into shared chunks", async() => {
    const editor = await createTempDir("studio-editor-page-");
    await fs.mkdir(path.join(editor, "src"));
    await fs.mkdir(path.join(editor, "public"));
    await fs.writeFile(
      path.join(editor, "index.html"),
      "<link rel=\"stylesheet\" href=\"./main.css\">" +
      "<link rel=\"stylesheet\" href=\"./src/editor.css\">" +
      "<script type=\"module\" src=\"./src/index.ts\"></script>"
    );
    await fs.writeFile(path.join(editor, "public", "main.css"), kEditorCss);
    await fs.writeFile(path.join(editor, "src", "editor.css"), kEditorCss);
    const shared = path
      .relative(path.join(editor, "src"), path.join(root, "shared.ts"))
      .replaceAll("\\", "/");
    await fs.writeFile(
      path.join(editor, "src", "index.ts"),
      `import { mount } from "${shared}";\nmount("editor");\n`
    );
    const outDir = path.join(root, "compiled");

    try {
      await buildStudio(
        voxelMapPages(dist, path.join(editor, "index.html")),
        outDir
      );
      const editorDir = path.join(outDir, "editors", "voxel-map");
      const shellScripts = await readScripts(path.join(outDir, "index.html"));
      const editorScripts = await readScripts(path.join(editorDir, "index.html"));
      const editorHtml = await fs.readFile(
        path.join(editorDir, "index.html"),
        "utf8"
      );

      assert.ok(editorScripts.length > 0);
      assert.ok(
        editorScripts.every((script) => script.startsWith(
          path.join(outDir, "assets")
        ))
      );
      assert.ok(shellScripts.some((script) => editorScripts.includes(script)));
      assert.match(editorHtml, kBundledStylesheet);
      assert.strictEqual(
        await fs.readFile(path.join(editorDir, "main.css"), "utf8"),
        kEditorCss
      );
    }
    finally {
      await removeTempDir(editor);
    }
  });

  test("rejects an editor page with a root-absolute URL", async() => {
    const editor = await createTempDir("studio-editor-page-");
    const page = path.join(editor, "index.html");
    await fs.writeFile(
      page,
      "<script type=\"module\" src=\"/src/index.ts\"></script>"
    );

    try {
      await assert.rejects(
        buildStudio(voxelMapPages(dist, page), path.join(root, "rejected")),
        /"\/src\/index\.ts": editor pages use relative URLs/
      );
    }
    finally {
      await removeTempDir(editor);
    }
  });

  test("copies the built pages of the editors it does not compile", async() => {
    const outDir = path.join(root, "out");
    await buildStudio(voxelMapPages(dist), outDir);

    assert.strictEqual(
      await fs.readFile(
        path.join(outDir, "editors", "voxel-map", "index.html"),
        "utf8"
      ),
      INDEX_HTML
    );
    assert.strictEqual(
      await fs.readFile(
        path.join(outDir, "editors", "voxel-map", "assets", "index.js"),
        "utf8"
      ),
      BUNDLE
    );
  });
});
