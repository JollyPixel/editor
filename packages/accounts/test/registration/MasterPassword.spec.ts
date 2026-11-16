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
  createMembers,
  databaseWith,
  registration
} from "../helpers/accounts.ts";
import {
  InvalidMasterPasswordError,
  MasterPasswordRequiredError
} from "#src/node.ts";

// CONSTANTS
const kSecret = "open sesame";
const kWrongSecret = "guess";

describe("master password", () => {
  test("makes the first account give it before it owns the server", async() => {
    using database = createDatabase();
    const members = createMembers(database, {
      masterPassword: kSecret
    });

    await assert.rejects(
      members.register(registration("Mallory"), ADDRESS),
      MasterPasswordRequiredError
    );
    await assert.rejects(
      members.register(registration("Mallory", kWrongSecret), ADDRESS),
      InvalidMasterPasswordError
    );
    const alice = await activeAccount(
      members.register(registration("Alice", kSecret), ADDRESS)
    );

    assert.deepEqual([alice.role, alice.owner], ["admin", true]);
    assert.equal(database.accounts.size, 1);
  });

  test("leaves later registrations to the join policy, whatever they give", async() => {
    using database = databaseWith("Alice");
    const members = createMembers(database, {
      masterPassword: kSecret,
      join: "request"
    });

    const results = [
      await members.register(registration("Bob"), ADDRESS),
      await members.register(registration("Carol", kSecret), ADDRESS),
      await members.register(registration("Dave", kWrongSecret), ADDRESS)
    ];

    assert.deepEqual(results, [
      { status: "pending" },
      { status: "pending" },
      { status: "pending" }
    ]);
  });

  test("refuses an empty secret", () => {
    using database = createDatabase();

    assert.throws(
      () => createAccounts(database, {
        masterPassword: ""
      }),
      RangeError
    );
  });
});
