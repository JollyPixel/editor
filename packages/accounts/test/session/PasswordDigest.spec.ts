// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PasswordDigest } from "#src/session/PasswordDigest.ts";
import { InvalidPasswordError } from "#src/index.ts";

describe("PasswordDigest.parse", () => {
  test("refuses anything but a 256-bit base64url digest", () => {
    assert.throws(
      () => PasswordDigest.parse("correct horse"),
      InvalidPasswordError
    );
  });
});
