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
} from "#src/index.ts";

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
      resolveContentType("a.pixelart", { ".pixelart": "application/json" }),
      "application/json"
    );
  });
});
