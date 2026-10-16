// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { EditorPrefetch } from "../../src/editors/EditorPrefetch.ts";

// CONSTANTS
const kBase = "http://localhost/studio/";
const kVoxelMapPage = `<!doctype html>
<html>
<head>
  <script type="module" crossorigin src="./assets/index-a1.js"></script>
  <link rel="modulepreload" crossorigin href="./assets/three-b2.js">
  <link rel="stylesheet" crossorigin href="./assets/index-c3.css">
  <link rel="icon" href="./favicon.svg">
</head>
<body><canvas></canvas></body>
</html>`;

function editor(
  name: string
) {
  return {
    name,
    kinds: [name]
  };
}

describe("EditorPrefetch", () => {
  test("downloads each editor page and its eager files", async(t) => {
    const requested: string[] = [];
    t.mock.method(globalThis, "fetch", async(input: URL) => {
      requested.push(input.href);

      return new Response(
        input.pathname.endsWith("/") ? kVoxelMapPage : "export {};"
      );
    });

    await new EditorPrefetch([editor("voxel-map")], kBase).run();

    assert.deepStrictEqual(requested.sort(), [
      "http://localhost/studio/editors/voxel-map/",
      "http://localhost/studio/editors/voxel-map/assets/index-a1.js",
      "http://localhost/studio/editors/voxel-map/assets/index-c3.css",
      "http://localhost/studio/editors/voxel-map/assets/three-b2.js"
    ]);
  });

  test("keeps prefetching the other editors when one page fails", async(t) => {
    const requested: string[] = [];
    t.mock.method(globalThis, "fetch", async(input: URL) => {
      requested.push(input.href);
      if (input.pathname.startsWith("/studio/editors/pixel-art/")) {
        throw new TypeError("Failed to fetch");
      }
      if (input.pathname.startsWith("/studio/editors/voxel-model/")) {
        return new Response("", { status: 404 });
      }

      return new Response(
        input.pathname.endsWith("/") ? kVoxelMapPage : "export {};"
      );
    });

    await new EditorPrefetch(
      [editor("pixel-art"), editor("voxel-model"), editor("voxel-map")],
      kBase
    ).run();

    assert.equal(
      requested.filter((url) => url.includes("/voxel-map/assets/")).length,
      3
    );
  });
});
