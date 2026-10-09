// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  createDirectory,
  databaseWith,
  name,
  registration,
  requestAccess
} from "./helpers/accounts.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";
import {
  AccountChangeRefusedError,
  UsernameTakenError
} from "#src/node.ts";

function requests(
  directory: AccountDirectory
): string[] {
  return [...directory.requests()].map((request) => request.username);
}

function usernames(
  directory: AccountDirectory
): string[] {
  return [...directory].map((account) => account.username);
}

describe("AccountDirectory access requests", () => {
  test("keeps a registration without the master password pending apart from the accounts", async() => {
    using database = databaseWith("Alice");
    const directory = createDirectory(database, {
      masterPassword: {
        secret: "open sesame",
        accessRequests: true
      }
    });

    assert.deepEqual(
      await directory.register(registration("Bob"), ADDRESS),
      { status: "pending" }
    );
    await assert.rejects(
      directory.register(registration("ALICE"), ADDRESS),
      UsernameTakenError
    );

    assert.deepEqual(requests(directory), ["Bob"]);
    assert.deepEqual(usernames(directory), ["Alice"]);
    assert.equal(database.accounts.named(name("bob"))?.role, "spectator");
  });

  test("approves a request with the role an admin picks", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    requestAccess(database, "Bob");
    const directory = createDirectory(database);

    const approved = directory.approve(alice.id, name("bob"), "member");

    assert.equal(approved.role, "member");
    assert.deepEqual(requests(directory), []);
    assert.deepEqual(usernames(directory), ["Alice", "Bob"]);
  });

  test("refuses to approve for a non-admin, an undeclared role or an active account", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    requestAccess(database, "Carol");
    const directory = createDirectory(database);

    for (const approve of [
      () => directory.approve(bob.id, name("carol"), "member"),
      () => directory.approve(alice.id, name("carol"), "editor"),
      () => directory.approve(alice.id, name("bob"), "member")
    ]) {
      assert.throws(approve, AccountChangeRefusedError);
    }
    assert.deepEqual(requests(directory), ["Carol"]);
  });

  test("denies a request and frees its username", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    requestAccess(database, "Bob");
    const directory = createDirectory(database);

    directory.deny(alice.id, name("bob"));
    await directory.register(registration("Bob"), ADDRESS);

    assert.deepEqual(requests(directory), []);
    assert.deepEqual(usernames(directory), ["Alice", "Bob"]);
  });

  test("refuses to deny for a non-admin or an active account", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    requestAccess(database, "Carol");
    const directory = createDirectory(database);

    for (const deny of [
      () => directory.deny(bob.id, name("carol")),
      () => directory.deny(alice.id, name("bob"))
    ]) {
      assert.throws(deny, AccountChangeRefusedError);
    }
    assert.equal(database.accounts.size, 3);
  });

  test("refuses a non-admin before telling whether a request exists", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const directory = createDirectory(database);

    for (const change of [
      () => directory.approve(bob.id, name("nobody"), "member"),
      () => directory.deny(bob.id, name("nobody"))
    ]) {
      assert.throws(change, {
        name: "AccountChangeRefusedError",
        message: "only an admin manages accounts"
      });
    }
  });

  test("keeps role changes, removal and ownership away from a request", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    requestAccess(database, "Bob");
    const directory = createDirectory(database);

    for (const change of [
      () => directory.assignRole(alice.id, name("bob"), "member"),
      () => directory.remove(alice.id, name("bob")),
      () => directory.transferOwnership(alice.id, name("bob"))
    ]) {
      assert.throws(change, {
        name: "AccountChangeRefusedError",
        message: "no account is named \"bob\""
      });
    }
    assert.deepEqual(requests(directory), ["Bob"]);
  });
});
