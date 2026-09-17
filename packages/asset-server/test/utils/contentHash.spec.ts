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
  test("is stable for identical bytes", () => {
    assert.strictEqual(
      contentHash(bytes("hello")),
      contentHash(bytes("hello"))
    );
  });

  test("differs for different bytes", () => {
    assert.notStrictEqual(
      contentHash(bytes("hello")),
      contentHash(bytes("world"))
    );
  });

  test("is a sha256 hex digest", () => {
    assert.match(contentHash(bytes("hello")), /^[0-9a-f]{64}$/);
  });
});
