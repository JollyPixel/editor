// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  InvalidUsernameError,
  Username
} from "#src/index.ts";

describe("Username.parse", () => {
  test("keeps the display casing and keys on the lowercase form", () => {
    const username = Username.parse("  Alice.B-2  ");

    assert.equal(username.value, "Alice.B-2");
    assert.equal(username.key, "alice.b-2");
  });

  test("folds compatibility characters before comparing", () => {
    assert.equal(Username.parse("Ａｌｉｃｅ").key, "alice");
  });

  test("accepts letters beyond ASCII", () => {
    assert.equal(Username.parse("Élodie").key, "élodie");
  });

  for (const input of ["a", "x".repeat(33), "-alice", "al ice", "alice!"]) {
    test(`refuses ${JSON.stringify(input)}`, () => {
      assert.throws(
        () => Username.parse(input),
        InvalidUsernameError
      );
    });
  }
});
