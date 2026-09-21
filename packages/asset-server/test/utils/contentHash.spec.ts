// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { contentHash } from "#src/utils/index.ts";
import { bytes } from "../helpers/bytes.ts";

describe("contentHash", () => {
  test("is stable for identical bytes", async() => {
    assert.strictEqual(
      await contentHash(bytes("hello")),
      await contentHash(bytes("hello"))
    );
  });

  test("differs for different bytes", async() => {
    assert.notStrictEqual(
      await contentHash(bytes("hello")),
      await contentHash(bytes("world"))
    );
  });

  test("is a sha256 hex digest", async() => {
    assert.strictEqual(
      await contentHash(bytes("hello")),
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});
