// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FIXED_HASH,
  databaseWith,
  name
} from "../helpers/accounts.ts";

// CONSTANTS
const kAvatar = {
  hash: "0123456789abcdef",
  bytes: new Uint8Array([1, 2, 3])
};

describe("AccountRepository reads", () => {
  test("finds an account by id and by name under any casing, with its hash", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;

    assert.deepEqual(database.accounts.byId(alice.id), alice);
    assert.deepEqual(database.accounts.named(name("ALICE")), alice);
    assert.deepEqual(database.accounts.credentials(name("alice")), {
      account: alice,
      hash: FIXED_HASH
    });
    assert.equal(database.accounts.byId("nobody"), null);
    assert.equal(database.accounts.named(name("carol")), null);
    assert.equal(database.accounts.credentials(name("carol")), null);
  });

  test("lists accounts oldest first with the owner", () => {
    using database = databaseWith("Alice", "Bob", "Carol");

    assert.deepEqual(
      [...database.accounts].map(({ username, owner }) => [username, owner]),
      [["Alice", true], ["Bob", false], ["Carol", false]]
    );
    assert.equal(database.accounts.size, 3);
  });

  test("names the stored avatar hash on every read of the account", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;

    database.avatars.replace(alice.id, kAvatar);
    const updated = alice.withAvatar(kAvatar.hash);

    assert.deepEqual(database.accounts.byId(alice.id), updated);
    assert.deepEqual(database.accounts.named(name("alice")), updated);
    assert.deepEqual([...database.accounts], [updated]);
  });
});

describe("AccountRepository writes", () => {
  test("moves the single ownership to the account saved as owner", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;

    database.accounts.save(bob.withOwnership(true));

    assert.deepEqual(
      [...database.accounts].map(({ owner }) => owner),
      [false, true]
    );
  });
});
