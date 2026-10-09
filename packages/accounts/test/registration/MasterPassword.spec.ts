// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  createAccounts,
  createDirectory,
  createStore,
  registration,
  storeWith
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
    using store = createStore();
    const directory = createDirectory(store, {
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
    const alice = await directory.register(registration("Alice", kSecret), ADDRESS);

    assert.equal(alice.role, "admin");
    assert.deepEqual(
      [...directory].map((account) => account.username),
      ["Alice"]
    );
  });

  test("lets later accounts register without it, but not with a wrong one", async() => {
    using store = storeWith("Alice");
    const directory = createDirectory(store, {
      masterPassword: {
        secret: kSecret
      }
    });

    const bob = await directory.register(registration("Bob"), ADDRESS);
    const carol = await directory.register(registration("Carol", kSecret), ADDRESS);

    assert.equal(bob.role, "spectator");
    assert.equal(carol.role, "spectator");
    await assert.rejects(
      directory.register(registration("Dave", kWrongSecret), ADDRESS),
      InvalidMasterPasswordError
    );
  });

  test("makes every account give it when required", async() => {
    using store = storeWith("Alice");
    const directory = createDirectory(store, {
      masterPassword: {
        secret: "open sesame",
        required: true
      }
    });

    await assert.rejects(
      directory.register(registration("Bob"), ADDRESS),
      MasterPasswordRequiredError
    );
    const bob = await directory.register(registration("Bob", kSecret), ADDRESS);

    assert.equal(bob.role, "spectator");
  });

  test("sends the master password with a registration and answers its refusals", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store, {
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
    const alice = await client.register("Alice", "correct horse", kSecretBody);

    assert.equal(alice.role, "admin");
  });

  test("refuses an empty secret", () => {
    using store = createStore();

    assert.throws(
      () => createAccounts(store, {
        masterPassword: {
          secret: ""
        }
      }),
      RangeError
    );
  });
});
