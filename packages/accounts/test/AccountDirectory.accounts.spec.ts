// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  activeAccount,
  createDirectory,
  databaseWith,
  databaseWithRetiredRole,
  name,
  registration
} from "./helpers/accounts.ts";
import { solidPng } from "./helpers/avatar/images.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";
import {
  AccountChangeRefusedError,
  UsernameTakenError
} from "#src/node.ts";

function roles(
  directory: AccountDirectory
): string[] {
  return [...directory].map(
    ({ username, role, owner }) => `${username}:${role}${owner ? ":owner" : ""}`
  );
}

describe("AccountDirectory.register", () => {
  test("makes the first account the admin owner and later ones the default role", async() => {
    const directory = createDirectory();

    await activeAccount(directory.register(registration("Alice"), ADDRESS));
    await activeAccount(directory.register(registration("Bob"), ADDRESS));

    assert.deepEqual(roles(directory), ["Alice:admin:owner", "Bob:spectator"]);
  });

  test("refuses a username that differs only by case", async() => {
    using database = databaseWith("Alice");
    const directory = createDirectory(database);

    await assert.rejects(
      directory.register(registration("aLICE"), ADDRESS),
      UsernameTakenError
    );
    assert.equal(database.accounts.size, 1);
  });

  test("reads a role that is no longer declared as the default role", () => {
    using database = databaseWithRetiredRole();
    const [, bob] = database.accounts;
    const directory = createDirectory(database);

    assert.equal(bob.role, "editor");
    assert.equal(directory.account(bob.id)?.role, "spectator");
    assert.deepEqual(roles(directory), ["Alice:admin:owner", "Bob:spectator"]);
  });
});

describe("AccountDirectory.assignRole", () => {
  test("stores the new role of an account", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);

    directory.assignRole(alice.id, name("bob"), "member");

    assert.equal(database.accounts.byId(bob.id)?.role, "member");
  });

  test("refuses a role that is not declared", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice] = database.accounts;
    const directory = createDirectory(database);

    assert.throws(
      () => directory.assignRole(alice.id, name("bob"), "editor"),
      {
        name: "AccountChangeRefusedError",
        message: "\"editor\" is not a role"
      }
    );
    assert.deepEqual(roles(directory), ["Alice:admin:owner", "Bob:spectator"]);
  });

  test("refuses an actor that is not an admin or does not exist", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [, bob] = database.accounts;
    const directory = createDirectory(database);

    for (const actorId of [bob.id, "nobody"]) {
      assert.throws(
        () => directory.assignRole(actorId, name("carol"), "member"),
        AccountChangeRefusedError
      );
    }
    assert.deepEqual(
      roles(directory),
      ["Alice:admin:owner", "Bob:spectator", "Carol:spectator"]
    );
  });

  test("refuses an unknown account", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const directory = createDirectory(database);

    assert.throws(
      () => directory.assignRole(alice.id, name("carol"), "member"),
      {
        name: "AccountChangeRefusedError",
        message: "no account is named \"carol\""
      }
    );
  });

  test("refuses to change the role of the owner, even for the owner", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);
    directory.assignRole(alice.id, name("bob"), "admin");

    for (const actor of [alice, bob]) {
      assert.throws(
        () => directory.assignRole(actor.id, name("alice"), "member"),
        {
          name: "AccountChangeRefusedError",
          message: "\"Alice\" is the owner"
        }
      );
    }
    assert.equal(
      directory.assignRole(bob.id, name("bob"), "member").role,
      "member"
    );
  });
});

describe("AccountDirectory.remove", () => {
  test("deletes the account", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);

    directory.remove(alice.id, name("BOB"));

    assert.equal(directory.account(bob.id), null);
    assert.equal(database.accounts.size, 1);
  });

  test("refuses an actor that is not an admin, and the owner", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);

    assert.throws(
      () => directory.remove(bob.id, name("carol")),
      AccountChangeRefusedError
    );
    assert.throws(
      () => directory.remove(alice.id, name("alice")),
      AccountChangeRefusedError
    );
    assert.equal(database.accounts.size, 3);
  });
});

describe("AccountDirectory.transferOwnership", () => {
  test("hands ownership to an account, promotes it to admin and keeps the previous owner admin", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);

    const owner = directory.transferOwnership(alice.id, name("bob"));

    assert.deepEqual(owner, directory.account(bob.id));
    assert.deepEqual(roles(directory), ["Alice:admin", "Bob:admin:owner"]);
    directory.remove(bob.id, name("alice"));
    assert.equal(database.accounts.size, 1);
  });

  test("refuses an actor that is not the owner", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);
    directory.assignRole(alice.id, name("bob"), "admin");

    assert.throws(
      () => directory.transferOwnership(bob.id, name("carol")),
      {
        name: "AccountChangeRefusedError",
        message: "only the owner transfers ownership"
      }
    );
    assert.equal(directory.account(alice.id)?.owner, true);
  });
});

describe("AccountDirectory.replaceAvatar", () => {
  test("refuses an unknown account", async() => {
    const directory = createDirectory();

    await assert.rejects(
      directory.replaceAvatar("nobody", await solidPng(8, 8)),
      AccountChangeRefusedError
    );
  });
});
