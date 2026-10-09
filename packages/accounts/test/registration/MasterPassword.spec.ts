// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createAccounts,
  createStore,
  name,
  storeWith
} from "../helpers/accounts.ts";
import { listenAccounts } from "../helpers/accountsServer.ts";
import type { AccountsRequestError } from "#src/index.ts";
import {
  InvalidMasterPasswordError,
  MasterPasswordRequiredError
} from "#src/node.ts";
import { PasswordDigest } from "#src/session/PasswordDigest.ts";

// CONSTANTS
const kPassword = PasswordDigest.parse("p".repeat(43));
const kSecret = {
  masterPassword: "open sesame"
};
const kWrongSecret = {
  masterPassword: "guess"
};

describe("Accounts master password", () => {
  test("makes the first account give it before it becomes admin", async() => {
    using accounts = createAccounts(createStore(), {
      masterPassword: {
        secret: "open sesame"
      }
    });

    await assert.rejects(
      accounts.register(name("Mallory"), kPassword),
      MasterPasswordRequiredError
    );
    await assert.rejects(
      accounts.register(name("Mallory"), kPassword, kWrongSecret),
      InvalidMasterPasswordError
    );
    const alice = await accounts.register(name("Alice"), kPassword, kSecret);

    assert.equal(alice.account.role, "admin");
    assert.deepEqual(
      [...accounts].map((account) => account.username),
      ["Alice"]
    );
  });

  test("lets later accounts register without it, but not with a wrong one", async() => {
    using accounts = createAccounts(storeWith("Alice"), {
      masterPassword: {
        secret: "open sesame"
      }
    });

    const bob = await accounts.register(name("Bob"), kPassword);
    const carol = await accounts.register(name("Carol"), kPassword, kSecret);

    assert.equal(bob.account.role, "spectator");
    assert.equal(carol.account.role, "spectator");
    await assert.rejects(
      accounts.register(name("Dave"), kPassword, kWrongSecret),
      InvalidMasterPasswordError
    );
  });

  test("makes every account give it when required", async() => {
    using accounts = createAccounts(storeWith("Alice"), {
      masterPassword: {
        secret: "open sesame",
        required: true
      }
    });

    await assert.rejects(
      accounts.register(name("Bob"), kPassword),
      MasterPasswordRequiredError
    );
    const bob = await accounts.register(name("Bob"), kPassword, kSecret);

    assert.equal(bob.account.role, "spectator");
  });

  test("sends the master password with a registration and answers its refusals", async() => {
    using store = createStore();
    await using server = await listenAccounts(createAccounts(store, {
      masterPassword: {
        secret: "open sesame"
      }
    }));
    const { client } = server.browser();

    await assert.rejects(
      client.register("Alice", "correct horse"),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "master-password-required"
    );
    await assert.rejects(
      client.register("Alice", "correct horse", kWrongSecret),
      (error: AccountsRequestError) => error.status === 403 &&
        error.code === "invalid-master-password"
    );
    const alice = await client.register("Alice", "correct horse", kSecret);

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
