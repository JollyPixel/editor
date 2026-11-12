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
import {
  BLOCKSET_ASSET,
  VOXEL_MAP_ASSET
} from "@jolly-pixel/asset.voxel-map";
import {
  DEFAULT_CATALOG_MAX_CONTENT_BYTES,
  TEXTURE_ASSET
} from "@jolly-pixel/asset-server";
import { PROJECT_MANIFEST_FILE } from "@jolly-pixel/server";
import {
  listen,
  voxelMapProject
} from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { projectManifest } from "../../vite/projectManifest.ts";
import {
  createTempDir,
  removeTempDir
} from "../helpers/tempDir.ts";

// CONSTANTS
const kManifest = {
  editors: [
    {
      name: "voxel-map",
      kinds: ["voxelmap"],
      preferences: [],
      sharedPreferences: [],
      sceneComponents: []
    }
  ],
  kinds: [
    ...[BLOCKSET_ASSET, VOXEL_MAP_ASSET].map((descriptor) => {
      return {
        ...descriptor,
        convertsFrom: [],
        extensions: [descriptor.extension]
      };
    }),
    {
      ...TEXTURE_ASSET,
      convertsFrom: [],
      extensions: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".ktx2"],
      preview: "server"
    }
  ],
  kindPackages: [
    {
      name: "@jolly-pixel/asset.voxel-map",
      kinds: [BLOCKSET_ASSET.kind, VOXEL_MAP_ASSET.kind]
    }
  ],
  maxContentBytes: DEFAULT_CATALOG_MAX_CONTENT_BYTES
};

describe("projectManifest", () => {
  let root: string;

  before(async() => {
    root = await createTempDir("studio-manifest-");
    await fs.writeFile(
      path.join(root, "index.html"),
      "<script type=\"module\" src=\"./main.ts\"></script>"
    );
    await fs.writeFile(
      path.join(root, "main.ts"),
      "document.title = \"studio\";\n"
    );
  });

  after(async() => {
    await removeTempDir(root);
  });

  test("serves the editors and the kinds on the dev server", async() => {
    const vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: {
        middlewareMode: true
      },
      plugins: [projectManifest(voxelMapProject(root, "/pkg/dist"))]
    });
    await using server = await listen(vite.middlewares);

    try {
      const response = await server.fetch(`/${PROJECT_MANIFEST_FILE}`);

      assert.strictEqual(
        response.headers.get("content-type"),
        "application/json; charset=utf-8"
      );
      assert.deepEqual(await response.json(), kManifest);
    }
    finally {
      await vite.close();
    }
  });

  test("writes the editors and the kinds on build", async() => {
    const outDir = path.join(root, "out");
    await build({
      root,
      configFile: false,
      logLevel: "silent",
      build: {
        outDir
      },
      plugins: [projectManifest(voxelMapProject(root, "/pkg/dist"))]
    });

    assert.deepEqual(
      JSON.parse(
        await fs.readFile(path.join(outDir, PROJECT_MANIFEST_FILE), "utf8")
      ),
      kManifest
    );
  });
});
