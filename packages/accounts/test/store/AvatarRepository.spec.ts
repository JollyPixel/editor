// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { databaseWith } from "../helpers/accounts.ts";

describe("AvatarRepository", () => {
  test("replaces the previous avatar of an account", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;

    assert.equal(database.avatars.find(alice.id), null);
    database.avatars.replace(alice.id, {
      hash: "0123456789abcdef",
      bytes: new Uint8Array([1, 2, 3])
    });
    database.avatars.replace(alice.id, {
      hash: "fedcba9876543210",
      bytes: new Uint8Array([4])
    });

    assert.deepEqual(database.avatars.find(alice.id), {
      hash: "fedcba9876543210",
      bytes: new Uint8Array([4])
    });
  });
});
