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

// Import Third-party Dependencies
import {
  build,
  createServer,
  type Connect
} from "vite";

// Import Internal Dependencies
import {
  createEditorPagesHandler,
  editorPagesPlugin,
  editorsModule,
  EDITORS_MODULE_ID
} from "../vite/editorPagesPlugin.ts";
import type { EditorPackage } from "../vite/editorManifest.ts";

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

function voxelMapEditor(
  dist: string
): EditorPackage {
  return {
    package: "@jolly-pixel/editor.voxel-map",
    name: "voxel-map",
    kinds: ["voxelmap"],
    dist
  };
}

function listen(
  handler: Connect.NextHandleFunction
): Promise<PagesServer> {
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

async function removeTemp(
  dir: string
): Promise<void> {
  await fs.rm(dir, {
    recursive: true,
    force: true,
    maxRetries: 3
  });
}

describe("createEditorPagesHandler", () => {
  let dist: string;
  let server: PagesServer;

  before(async() => {
    dist = await createDist();
    server = await listen(createEditorPagesHandler([voxelMapEditor(dist)]));
  });

  after(async() => {
    await server[Symbol.asyncDispose]();
    await removeTemp(path.dirname(dist));
  });

  test("serves index.html for a directory request", async() => {
    const response = await server.fetch("/editors/voxel-map/");

    assert.strictEqual(response.status, 200);
    assert.strictEqual(
      response.headers.get("content-type"),
      "text/html;charset=utf-8"
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
      "text/javascript"
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

  test("answers a matching ETag with 304", async() => {
    const first = await server.fetch("/editors/voxel-map/assets/index.js");
    const etag = first.headers.get("etag");
    assert.ok(etag);
    await first.text();

    const response = await server.fetch("/editors/voxel-map/assets/index.js", {
      headers: {
        "if-none-match": etag
      }
    });

    assert.strictEqual(response.status, 304);
    assert.strictEqual(await response.text(), "");
  });

  test("rejects a path escaping the dist folder", async() => {
    const response = await server.fetch(
      "/editors/voxel-map/..%2foutside.txt"
    );

    assert.strictEqual(response.status, 404);
    assert.notStrictEqual(await response.text(), "secret");
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
  let dist: string;
  let root: string;

  before(async() => {
    dist = await createDist();
    root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-root-"));
    await fs.writeFile(
      path.join(root, "index.html"),
      "<script type=\"module\" src=\"./main.ts\"></script>"
    );
    await fs.writeFile(
      path.join(root, "main.ts"),
      `import editors from "${EDITORS_MODULE_ID}";\n` +
      "document.title = JSON.stringify(editors);\n"
    );
  });

  after(async() => {
    await removeTemp(path.dirname(dist));
    await removeTemp(root);
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
      plugins: [editorPagesPlugin([voxelMapEditor(dist)])]
    });
    await using server = await listen(vite.middlewares);

    try {
      const response = await server.fetch("/editors/voxel-map/");

      assert.strictEqual(response.status, 200);
      assert.strictEqual(await response.text(), kIndexHtml);
    }
    finally {
      await vite.close();
    }
  });

  test("bundles the descriptors and copies the pages on build", async() => {
    const outDir = path.join(root, "out");
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [editorPagesPlugin([voxelMapEditor(dist)])]
    });

    const assets = await fs.readdir(path.join(outDir, "assets"));
    const bundle = await fs.readFile(
      path.join(outDir, "assets", assets[0]),
      "utf8"
    );
    assert.match(bundle, /voxel-map/);
    assert.strictEqual(
      await fs.readFile(
        path.join(outDir, "editors", "voxel-map", "index.html"),
        "utf8"
      ),
      kIndexHtml
    );
    assert.strictEqual(
      await fs.readFile(
        path.join(outDir, "editors", "voxel-map", "assets", "index.js"),
        "utf8"
      ),
      kBundle
    );
  });
});

describe("editorsModule", () => {
  test("exports the name and kinds of each editor", () => {
    assert.strictEqual(
      editorsModule([voxelMapEditor("/pkg/dist")]),
      "export default [{\"name\":\"voxel-map\",\"kinds\":[\"voxelmap\"]}];\n"
    );
  });
});
