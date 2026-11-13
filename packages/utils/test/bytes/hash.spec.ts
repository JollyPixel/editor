// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { sha256Hex } from "#src/index.ts";

describe("sha256Hex", () => {
  test("is a sha256 hex digest", async() => {
    assert.strictEqual(
      await sha256Hex(new TextEncoder().encode("hello")),
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});
