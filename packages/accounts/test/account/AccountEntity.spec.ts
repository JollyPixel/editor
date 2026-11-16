// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { name } from "../helpers/accounts.ts";
import { AccountChangeRefusedError } from "#src/node.ts";

// CONSTANTS
const kAlice = new AccountEntity({
  id: "a1",
  username: "Alice",
  avatarHash: null,
  owner: false
});

describe("AccountEntity", () => {
  test("claim creates the owner, register does not own", () => {
    const owner = AccountEntity.claim(name("Alice"));
    const account = AccountEntity.register(name("Bob"));

    assert.deepEqual(
      [owner, account].map(({ username, owner }) => [username, owner]),
      [["Alice", true], ["Bob", false]]
    );
    assert.notEqual(owner.id, account.id);
  });

  test("assertOwner and assertNotOwner split owners from everyone else", () => {
    const owner = kAlice.withOwnership(true);

    assert.throws(() => kAlice.assertOwner(), AccountChangeRefusedError);
    assert.throws(
      () => owner.assertNotOwner(),
      {
        name: "AccountChangeRefusedError",
        message: "\"Alice\" is the owner"
      }
    );
    owner.assertOwner();
    kAlice.assertNotOwner();
  });

  test("transitions copy without touching the original", () => {
    const changed = kAlice.withOwnership(true).withAvatar("abc");

    assert.deepEqual(
      changed,
      new AccountEntity({
        id: "a1",
        username: "Alice",
        avatarHash: "abc",
        owner: true
      })
    );
    assert.equal(kAlice.owner, false);
    assert.equal(kAlice.avatarHash, null);
  });
});
