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
  name,
  requestAccess
} from "../helpers/accounts.ts";
import { SessionToken } from "#src/session/SessionToken.ts";

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

  test("lists accounts oldest first and counts the pending ones apart", () => {
    using database = databaseWith("Alice", "Bob");
    requestAccess(database, "Carol");

    assert.deepEqual(
      [...database.accounts].map(({ username, owner, pending }) => [username, owner, pending]),
      [["Alice", true, false], ["Bob", false, false], ["Carol", false, true]]
    );
    assert.equal(database.accounts.size, 3);
    assert.equal(database.accounts.pendingSize, 1);
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
  test("saves the role and status of an account", () => {
    using database = databaseWith("Alice");
    const bob = requestAccess(database, "Bob");

    database.accounts.save(bob.approved("member"));

    assert.deepEqual(database.accounts.byId(bob.id), bob.approved("member"));
  });

  test("moves the single ownership to the account saved as owner", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;

    database.accounts.save(bob.promotedToOwner());

    assert.deepEqual(
      [...database.accounts].map(({ owner }) => owner),
      [false, true]
    );
  });

  test("deletes an account with its sessions and avatar", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const token = SessionToken.mint();
    database.sessions.open(token, bob.id, Number.MAX_SAFE_INTEGER);
    database.avatars.replace(bob.id, kAvatar);

    database.accounts.delete(bob.id);

    assert.equal(database.accounts.byId(bob.id), null);
    assert.equal(database.sessions.owner(token), null);
    assert.equal(database.avatars.find(bob.id), null);
  });

  test("refuses to delete the owner while it holds ownership", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;

    assert.throws(
      () => database.accounts.delete(alice.id),
      /FOREIGN KEY/
    );
  });
});
