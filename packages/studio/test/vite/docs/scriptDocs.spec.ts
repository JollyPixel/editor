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
  createServer,
  type ViteDevServer
} from "vite";

// Import Internal Dependencies
import {
  DOCS_MODULE,
  scriptDocs
} from "../../../vite/docs/scriptDocs.ts";
import type { DocsBook } from "../../../src/shell/docs/DocsLibrary.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

// CONSTANTS
const kFiles = {
  "alpha/README.md": "<img src=\"./docs/banner.png\" alt=\"Alpha\">\n\nIntro\n",
  "alpha/docs/banner.png": "png",
  "alpha/docs/asset.md": "# `Asset`\n",
  "alpha/docs/systems/world.md": "# World\n",
  "alpha/docs/systems/systems.md": "# Systems overview\n",
  "alpha/docs/guides/hello-world.md": "No heading\n![missing](./gone.png)\n",
  "alpha/docs/CHANGELOG.md": "# Changes\n",
  "alpha/docs/notes.txt": "not a page"
};

interface LoadedPage {
  id: string;
  title: string;
}

function outline(
  books: readonly DocsBook[]
): unknown {
  return books.map((book) => {
    return {
      label: book.label,
      sections: book.sections.map((section) => {
        return {
          label: section.label,
          pages: section.pages.map(({ id, title }): LoadedPage => {
            return { id, title };
          })
        };
      })
    };
  });
}

describe("scriptDocs", () => {
  let root: string;
  let vite: ViteDevServer;
  let books: readonly DocsBook[];

  before(async() => {
    root = await createTempDir("studio-docs-");
    for (const [file, text] of Object.entries(kFiles)) {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), text);
    }
    vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: {
        middlewareMode: true
      },
      plugins: [
        scriptDocs(root, [
          { dir: "alpha", label: "Alpha" },
          { dir: "absent", label: "Absent" }
        ])
      ]
    });
    const module = await vite.ssrLoadModule(DOCS_MODULE);
    books = module.default;
  });

  after(async() => {
    await vite.close();
    await removeTempDir(root);
  });

  test("lists the README then the docs pages, guides first, by folder", () => {
    assert.deepEqual(outline(books), [
      {
        label: "Alpha",
        sections: [
          {
            label: undefined,
            pages: [
              { id: "alpha/README.md", title: "Introduction" },
              { id: "alpha/docs/asset.md", title: "Asset" }
            ]
          },
          {
            label: "Guides",
            pages: [
              { id: "alpha/docs/guides/hello-world.md", title: "Hello World" }
            ]
          },
          {
            label: "Systems",
            pages: [
              { id: "alpha/docs/systems/systems.md", title: "Systems overview" },
              { id: "alpha/docs/systems/world.md", title: "World" }
            ]
          }
        ]
      },
      {
        label: "Absent",
        sections: []
      }
    ]);
  });

  test("loads a page's Markdown with its images pointing at served files", async() => {
    const [intro] = books[0].sections[0].pages;
    const markdown = await intro.load();
    const source = /src="([^"]+)"/.exec(markdown)?.[1] ?? "";

    assert.ok(source.endsWith("/docs/banner.png"), source);
    assert.notEqual(source, "./docs/banner.png");
    const served = await vite.transformRequest(source);
    assert.ok(served !== null, `${source} is not served`);
  });

  test("keeps an image reference whose file does not exist", async() => {
    const guide = books[0].sections[1].pages[0];

    assert.equal(await guide.load(), kFiles["alpha/docs/guides/hello-world.md"]);
  });
});
