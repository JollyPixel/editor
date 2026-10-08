// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { prehashPassword } from "#src/index.ts";

describe("prehashPassword", () => {
  test("derives the same 256-bit digest for any casing of the username", async() => {
    const digest = await prehashPassword("Alice", "correct horse");

    assert.match(digest, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await prehashPassword("aLiCe", "correct horse"), digest);
  });

  test("salts the digest with the username", async() => {
    assert.notEqual(
      await prehashPassword("Alice", "correct horse"),
      await prehashPassword("Bob", "correct horse")
    );
  });
});
