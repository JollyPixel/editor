// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  hashPassword,
  verifyPassword
} from "#src/server/auth/password.ts";

describe("password hashing", () => {
  test("verifies only the password used to create the hash", async() => {
    const hash = await hashPassword("correct horse battery staple");

    assert.equal(
      await verifyPassword("correct horse battery staple", hash),
      true
    );
    assert.equal(await verifyPassword("wrong password", hash), false);
  });
});
