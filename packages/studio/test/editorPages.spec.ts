// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

// Import Internal Dependencies
import {
  createEditorPagesHandler,
  editorPagesPlugin,
  resolveEditorPages,
  EDITOR_PAGES_PREFIX
} from "../vite/editorPages.ts";

// CONSTANTS
const kPassThroughStatus = 418;
const kIndexHtml = "<!DOCTYPE html><title>Voxel Map Editor</title>";
const kBundle = "export const editor = true;";

interface PagesServer extends AsyncDisposable {
  fetch(pathname: string, init?: RequestInit): Promise<Response>;
}

async function createDist(): Promise<string> {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "studio-pages-"));
  const dist = path.join(parent, "dist");
  await fs.mkdir(path.join(dist, "assets"), { recursive: true });
  await fs.writeFile(path.join(dist, "index.html"), kIndexHtml);
  await fs.writeFile(path.join(dist, "assets", "index.js"), kBundle);
  await fs.writeFile(path.join(parent, "outside.txt"), "secret");

  return dist;
}

function listen(
  pages: ReadonlyMap<string, string>
): Promise<PagesServer> {
  const handler = createEditorPagesHandler({ pages });
  const server = http.createServer((request, response) => {
    handler(request, response, () => {
      response.statusCode = kPassThroughStatus;
      response.end();
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        fetch: (pathname, init) => fetch(
          `http://127.0.0.1:${port}${pathname}`,
          {
            redirect: "manual",
            ...init
          }
        ),
        [Symbol.asyncDispose]: () => new Promise((done) => {
          server.close(() => done());
        })
      });
    });
  });
}

describe("resolveEditorPages", () => {
  test("resolves the dist folder from the located package", () => {
    const located: string[] = [];
    const pages = resolveEditorPages(
      [
        {
          name: "voxel-map",
          package: "@jolly-pixel/editor.voxel-map"
        },
        {
          name: "pixel-art",
          package: "@jolly-pixel/editor.pixel-art",
          dist: "dist-page"
        }
      ],
      (packageName) => {
        located.push(packageName);

        return path.join("/pkg", packageName);
      }
    );

    assert.deepEqual(located, [
      "@jolly-pixel/editor.voxel-map",
      "@jolly-pixel/editor.pixel-art"
    ]);
    assert.strictEqual(
      pages.get("voxel-map"),
      path.resolve("/pkg/@jolly-pixel/editor.voxel-map/dist")
    );
    assert.strictEqual(
      pages.get("pixel-art"),
      path.resolve("/pkg/@jolly-pixel/editor.pixel-art/dist-page")
    );
  });

  test("locates the editor packages installed in the studio", () => {
    const pages = resolveEditorPages([
      {
        name: "voxel-map",
        package: "@jolly-pixel/editor.voxel-map"
      }
    ]);

    assert.match(
      pages.get("voxel-map") ?? "",
      /[\\/]voxel-map[\\/]dist$/
    );
  });
});

describe("createEditorPagesHandler", () => {
  let dist: string;
  let server: PagesServer;

  before(async() => {
    dist = await createDist();
    server = await listen(new Map([["voxel-map", dist]]));
  });

  after(async() => {
    await server[Symbol.asyncDispose]();
    await fs.rm(path.dirname(dist), {
      recursive: true,
      force: true,
      maxRetries: 3
    });
  });

  test("serves index.html for a directory request", async() => {
    const response = await server.fetch("/editors/voxel-map/");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "text/html; charset=utf-8"
    );
    assert.strictEqual(await response.text(), kIndexHtml);
  });

  test("serves index.html with a query string", async() => {
    const response = await server.fetch("/editors/voxel-map/?target=map-1");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(await response.text(), kIndexHtml);
  });

  test("redirects a bare editor path to its directory", async() => {
    const response = await server.fetch("/editors/voxel-map?target=map-1");

    assert.strictEqual(response.status, 302);
    assert.strictEqual(
      response.headers.get("location"),
      "/editors/voxel-map/?target=map-1"
    );
  });

  test("serves a bundle with its content type", async() => {
    const response = await server.fetch("/editors/voxel-map/assets/index.js");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "text/javascript; charset=utf-8"
    );
    assert.strictEqual(await response.text(), kBundle);
  });

  test("answers HEAD with headers only", async() => {
    const response = await server.fetch("/editors/voxel-map/", {
      method: "HEAD"
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-length"),
      String(kIndexHtml.length)
    );
    assert.strictEqual(await response.text(), "");
  });

  test("rejects a path escaping the dist folder", async() => {
    const response = await server.fetch(
      "/editors/voxel-map/..%2foutside.txt"
    );

    assert.strictEqual(response.status, 403);
  });

  test("returns 404 for a missing file", async() => {
    const response = await server.fetch("/editors/voxel-map/missing.js");

    assert.strictEqual(response.status, 404);
  });

  test("returns 404 for an unknown editor", async() => {
    assert.strictEqual(
      (await server.fetch("/editors/unknown/")).status,
      404
    );
    assert.strictEqual(
      (await server.fetch("/editors/unknown")).status,
      404
    );
  });

  test("passes other routes through", async() => {
    assert.strictEqual(
      (await server.fetch("/")).status,
      kPassThroughStatus
    );
    assert.strictEqual(
      (await server.fetch("/editors/")).status,
      kPassThroughStatus
    );
    assert.strictEqual(
      (await server.fetch("/assets/index.js")).status,
      kPassThroughStatus
    );
  });

  test("passes non-GET methods through", async() => {
    const response = await server.fetch("/editors/voxel-map/", {
      method: "POST"
    });

    assert.strictEqual(response.status, kPassThroughStatus);
  });
});

describe("editorPagesPlugin", () => {
  test("registers the handler on the dev server", () => {
    const registered: unknown[] = [];
    const plugin = editorPagesPlugin({
      pages: [
        {
          name: "voxel-map",
          package: "@jolly-pixel/editor.voxel-map"
        }
      ],
      locate: () => "/pkg"
    });
    const { configureServer } = plugin;
    assert.strictEqual(typeof configureServer, "function");

    const server = {
      middlewares: {
        use: (handler: unknown) => registered.push(handler)
      }
    };
    void (configureServer as (server: unknown) => void)(server);

    assert.strictEqual(plugin.apply, "serve");
    assert.strictEqual(registered.length, 1);
    assert.strictEqual(typeof registered[0], "function");
    assert.strictEqual(EDITOR_PAGES_PREFIX, "/editors/");
  });
});
