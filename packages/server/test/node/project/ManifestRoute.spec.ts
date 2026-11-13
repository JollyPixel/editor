// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ManifestRoute } from "#src/node/project/ManifestRoute.ts";
import { ProjectManifest } from "#src/project/ProjectManifest.ts";
import {
  listen,
  PASSED_ON_STATUS,
  voxelMapProject
} from "#src/testing.ts";

describe("ManifestRoute", () => {
  test("previews a listed kind in the frame unless its handler draws previews", () => {
    const route = new ManifestRoute(voxelMapProject(
      import.meta.dirname,
      "/pkg/dist",
      {
        previewKinds: ["voxelmap", "texture"]
      }
    ));
    const previews = new Map(
      ProjectManifest.parse(JSON.parse(route.source)).kinds
        .map(({ kind, preview }) => [kind, preview])
    );

    assert.equal(previews.get("voxelmap"), "frame");
    assert.equal(previews.get("texture"), "server");
    assert.equal(previews.get("blockset"), undefined);
  });

  test("carries the capabilities of each kind and which packages have options", () => {
    const route = new ManifestRoute(voxelMapProject(import.meta.dirname, "/pkg/dist"));
    const manifest = ProjectManifest.parse(JSON.parse(route.source));
    const capabilities = new Map(
      manifest.kinds.map(({ kind, capabilities = [] }) => [
        kind,
        capabilities.map(({ name }) => name)
      ])
    );

    assert.deepEqual(capabilities.get("blockset"), ["blocks", "materials", "tileSize"]);
    assert.deepEqual(capabilities.get("texture"), []);
    assert.deepEqual(
      manifest.kindPackages.map(({ name, configurable }) => [name, configurable]),
      [["@jolly-pixel/asset.voxel-map", true]]
    );
  });

  test("passes every other path to the next middleware", async() => {
    const route = new ManifestRoute(voxelMapProject(import.meta.dirname, "/pkg/dist"));
    await using server = await listen(route.middleware);

    for (const pathname of [
      "/node_modules/.vite/deps/lit.js",
      "/@fs/D:/project/src/index.ts",
      "/src/index.ts"
    ]) {
      const response = await server.fetch(pathname);

      assert.strictEqual(response.status, PASSED_ON_STATUS, pathname);
    }
  });
});
