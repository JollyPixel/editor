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
  editorsModule,
  readEditorPackages,
  resolveEditorPages,
  EDITOR_PAGES_PREFIX,
  EDITORS_MODULE_ID,
  type EditorPackage
} from "../vite/editorPages.ts";

// CONSTANTS
const kPassThroughStatus = 418;
const kIndexHtml = "<!DOCTYPE html><title>Voxel Map Editor</title>";
const kBundle = "export const editor = true;";
const kVoxelMapEditor: EditorPackage = {
  package: "@jolly-pixel/editor.voxel-map",
  name: "voxel-map",
  kinds: ["voxelmap"],
  dist: "/pkg/dist"
};

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

async function createPackage(
  editor: unknown
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-editor-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "editor",
      jollypixel: { editor }
    })
  );

  return root;
}

describe("readEditorPackages", () => {
  test("reads the editor manifest of each located package", async() => {
    const voxelMap = await createPackage({
      name: "voxel-map",
      kinds: ["voxelmap"]
    });
    const pixelArt = await createPackage({
      name: "pixel-art",
      kinds: ["pixelart"],
      dist: "dist-page"
    });
    const roots = new Map([
      ["@jolly-pixel/editor.voxel-map", voxelMap],
      ["@jolly-pixel/editor.pixel-art", pixelArt]
    ]);
    const located: string[] = [];
    const editors = readEditorPackages(roots.keys(), (packageName) => {
      located.push(packageName);

      return roots.get(packageName) ?? "";
    });

    assert.deepEqual(located, [...roots.keys()]);
    assert.deepEqual(editors, [
      {
        package: "@jolly-pixel/editor.voxel-map",
        name: "voxel-map",
        kinds: ["voxelmap"],
        dist: path.join(voxelMap, "dist")
      },
      {
        package: "@jolly-pixel/editor.pixel-art",
        name: "pixel-art",
        kinds: ["pixelart"],
        dist: path.join(pixelArt, "dist-page")
      }
    ]);
  });

  test("reads the editor packages installed in the studio", () => {
    const [voxelMap, voxelModel] = readEditorPackages([
      "@jolly-pixel/editor.voxel-map",
      "@jolly-pixel/editor.voxel-model"
    ]);

    assert.deepEqual(voxelMap.kinds, ["voxelmap"]);
    assert.deepEqual(voxelModel.kinds, ["voxelmodel"]);
    assert.match(voxelMap.dist, /[\\/]voxel-map[\\/]dist$/);
  });

  test("rejects a package without an editor manifest", async() => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-editor-"));
    await fs.writeFile(path.join(root, "package.json"), "{}");

    assert.throws(
      () => readEditorPackages(["editor"], () => root),
      /"editor" declares no "jollypixel.editor" manifest/
    );
  });

  test("rejects an invalid manifest", async() => {
    const manifests = [
      { name: "../escape", kinds: ["voxelmap"] },
      { name: "voxel-map", kinds: [] },
      { name: "voxel-map", kinds: [""] },
      { name: "voxel-map", kinds: ["voxelmap"], dist: 1 }
    ];
    for (const manifest of manifests) {
      const root = await createPackage(manifest);

      assert.throws(
        () => readEditorPackages(["editor"], () => root),
        TypeError
      );
    }
  });

  test("rejects two packages declaring the same editor", async() => {
    const root = await createPackage({
      name: "voxel-map",
      kinds: ["voxelmap"]
    });

    assert.throws(
      () => readEditorPackages(["a", "b"], () => root),
      /Editor "voxel-map" is declared by more than one package/
    );
  });
});

describe("resolveEditorPages", () => {
  test("maps each editor name to its dist folder", () => {
    const pages = resolveEditorPages([kVoxelMapEditor]);

    assert.deepEqual([...pages], [["voxel-map", "/pkg/dist"]]);
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
    const plugin = editorPagesPlugin({ editors: [kVoxelMapEditor] });
    const { configureServer } = plugin;
    assert.strictEqual(typeof configureServer, "function");

    const server = {
      middlewares: {
        use: (handler: unknown) => registered.push(handler)
      }
    };
    void (configureServer as (server: unknown) => void)(server);

    assert.strictEqual(registered.length, 1);
    assert.strictEqual(typeof registered[0], "function");
    assert.strictEqual(EDITOR_PAGES_PREFIX, "/editors/");
  });

  test("serves the editor descriptors as a virtual module", () => {
    const plugin = editorPagesPlugin({ editors: [kVoxelMapEditor] });
    const resolveId = plugin.resolveId as (id: string) => string | null;
    const load = plugin.load as (id: string) => string | null;
    const resolved = resolveId(EDITORS_MODULE_ID);

    assert.ok(resolved);
    assert.strictEqual(resolveId("lit"), null);
    assert.strictEqual(load(resolved), editorsModule([kVoxelMapEditor]));
    assert.strictEqual(load("lit"), null);
  });
});

describe("editorsModule", () => {
  test("exports the name and kinds of each editor", () => {
    assert.strictEqual(
      editorsModule([kVoxelMapEditor]),
      "export default [{\"name\":\"voxel-map\",\"kinds\":[\"voxelmap\"]}];\n"
    );
  });
});
