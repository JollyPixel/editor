// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ManifestRoute } from "../../../server/editors/ManifestRoute.ts";
import {
  listen,
  PASS_THROUGH_STATUS,
  voxelMapProject
} from "../../helpers/editorPages.ts";

describe("ManifestRoute", () => {
  test("passes every other path to the next middleware", async() => {
    const route = new ManifestRoute(voxelMapProject(import.meta.dirname, "/pkg/dist"));
    await using server = await listen(route.middleware);

    for (const pathname of [
      "/node_modules/.vite/deps/lit.js",
      "/@fs/D:/project/src/index.ts",
      "/src/index.ts"
    ]) {
      const response = await server.fetch(pathname);

      assert.strictEqual(response.status, PASS_THROUGH_STATUS, pathname);
    }
  });
});
