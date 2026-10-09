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
  createAccounts,
  createDatabase,
  createDirectory,
  databaseWith,
  registration
} from "../helpers/accounts.ts";
import { listenAccounts } from "../helpers/accountsServer.ts";
import type { AccountsRequestError } from "#src/index.ts";
import {
  InvalidMasterPasswordError,
  MasterPasswordRequiredError
} from "#src/node.ts";

// CONSTANTS
const kSecret = "open sesame";
const kSecretBody = {
  masterPassword: kSecret
};
const kWrongSecret = "guess";
const kWrongSecretBody = {
  masterPassword: kWrongSecret
};

describe("master password", () => {
  test("makes the first account give it before it becomes admin", async() => {
    using database = createDatabase();
    const directory = createDirectory(database, {
      masterPassword: {
        secret: kSecret
      }
    });

    await assert.rejects(
      directory.register(registration("Mallory"), ADDRESS),
      MasterPasswordRequiredError
    );
    await assert.rejects(
      directory.register(registration("Mallory", kWrongSecret), ADDRESS),
      InvalidMasterPasswordError
    );
    const alice = await activeAccount(
      directory.register(registration("Alice", kSecret), ADDRESS)
    );

    assert.equal(alice.role, "admin");
    assert.deepEqual(
      [...directory].map((account) => account.username),
      ["Alice"]
    );
  });

  test("lets later accounts register without it, but not with a wrong one", async() => {
    using database = databaseWith("Alice");
    const directory = createDirectory(database, {
      masterPassword: {
        secret: kSecret
      }
    });

    const bob = await activeAccount(
      directory.register(registration("Bob"), ADDRESS)
    );
    const carol = await activeAccount(
      directory.register(registration("Carol", kSecret), ADDRESS)
    );

    assert.equal(bob.role, "spectator");
    assert.equal(carol.role, "spectator");
    await assert.rejects(
      directory.register(registration("Dave", kWrongSecret), ADDRESS),
      InvalidMasterPasswordError
    );
  });

  test("turns a registration without it into an access request with accessRequests", async() => {
    using database = databaseWith("Alice");
    const directory = createDirectory(database, {
      masterPassword: {
        secret: kSecret,
        accessRequests: true
      }
    });

    const bob = await directory.register(registration("Bob"), ADDRESS);
    const carol = await activeAccount(
      directory.register(registration("Carol", kSecret), ADDRESS)
    );

    assert.deepEqual(bob, {
      status: "pending"
    });
    assert.equal(carol.role, "spectator");
  });

  test("sends the master password with a registration and answers its refusals", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database, {
      masterPassword: {
        secret: kSecret
      }
    }));
    const { client } = server.browser();

    await assert.rejects(
      client.register("Alice", "correct horse"),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "master-password-required"
    );
    await assert.rejects(
      client.register("Alice", "correct horse", kWrongSecretBody),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "invalid-master-password"
    );
    const alice = await activeAccount(
      client.register("Alice", "correct horse", kSecretBody)
    );

    assert.equal(alice.role, "admin");
  });

  test("refuses an empty secret", () => {
    using database = createDatabase();

    assert.throws(
      () => createAccounts(database, {
        masterPassword: {
          secret: ""
        }
      }),
      RangeError
    );
  });
});
