// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_CONTENT_TYPE,
  resolveContentType
} from "#src/node.ts";

describe("resolveContentType", () => {
  test("matches on the lowercased extension", () => {
    assert.strictEqual(
      resolveContentType("textures/BLOCK.PNG"),
      "image/png"
    );
  });

  test("falls back to the octet stream", () => {
    assert.strictEqual(
      resolveContentType("a.unknown"),
      DEFAULT_CONTENT_TYPE
    );
    assert.strictEqual(
      resolveContentType("LICENSE"),
      DEFAULT_CONTENT_TYPE
    );
  });

  test("uses the table it is given", () => {
    assert.strictEqual(
      resolveContentType("a.pixelart", { ".pixelart": "image/x-pixelart" }),
      "image/x-pixelart"
    );
  });

  test("adds a UTF-8 charset to a textual type without parameters", () => {
    assert.strictEqual(
      resolveContentType("a.pixelart", { ".pixelart": "application/json" }),
      "application/json; charset=utf-8"
    );
    assert.strictEqual(
      resolveContentType("icons/logo.svg"),
      "image/svg+xml; charset=utf-8"
    );
  });

  test("serves web page files as the octet stream", () => {
    for (const assetPath of ["index.html", "main.js", "style.css"]) {
      assert.strictEqual(
        resolveContentType(assetPath),
        DEFAULT_CONTENT_TYPE,
        assetPath
      );
    }
  });

  test("prefers the longest matching multi-dot extension", () => {
    const table = {
      ".json": "application/json",
      ".VoxelMap.json": "application/x-voxelmap"
    };

    assert.strictEqual(
      resolveContentType("maps/World.VoxelMap.json", table),
      "application/x-voxelmap"
    );
    assert.strictEqual(
      resolveContentType("maps/other.json", table),
      "application/json; charset=utf-8"
    );
  });

  test("ignores a file named after the extension alone", () => {
    assert.strictEqual(
      resolveContentType("dir/.json"),
      DEFAULT_CONTENT_TYPE
    );
  });
});
