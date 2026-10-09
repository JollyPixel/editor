// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FIXED_HASH,
  name,
  storeWith
} from "../helpers/accounts.ts";
import {
  AccessRequestsFullError,
  AccountChangeRefusedError,
  UsernameTakenError,
  type AccountStore
} from "#src/node.ts";

function requests(
  store: AccountStore
): string[] {
  return [...store]
    .filter((account) => account.pending)
    .map((account) => account.username);
}

describe("AccountStore access requests", () => {
  test("keeps a requested account pending under the default role", () => {
    using store = storeWith("Alice");

    const bob = store.requestAccess(name("Bob"), FIXED_HASH, 5);

    assert.equal(bob.pending, true);
    assert.equal(bob.role, "spectator");
    assert.equal(store.credentials(name("bob"))?.account.pending, true);
    assert.deepEqual(requests(store), ["Bob"]);
  });

  test("refuses a request past the limit and a taken username", () => {
    using store = storeWith("Alice");
    store.requestAccess(name("Bob"), FIXED_HASH, 1);

    assert.throws(
      () => store.requestAccess(name("Carol"), FIXED_HASH, 1),
      AccessRequestsFullError
    );
    assert.throws(
      () => store.requestAccess(name("ALICE"), FIXED_HASH, 5),
      UsernameTakenError
    );
    assert.equal(store.size, 2);
  });

  test("approves a request with the role an admin picks", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const bob = store.requestAccess(name("Bob"), FIXED_HASH, 5);

    const approved = store.approve(alice.id, name("bob"), "member");

    assert.equal(approved.pending, false);
    assert.equal(approved.role, "member");
    assert.deepEqual(store.accountById(bob.id), approved);
    assert.deepEqual(requests(store), []);
  });

  test("refuses to approve for a non-admin, an undeclared role or an active account", () => {
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    store.requestAccess(name("Carol"), FIXED_HASH, 5);

    for (const approve of [
      () => store.approve(bob.id, name("carol"), "member"),
      () => store.approve(alice.id, name("carol"), "editor"),
      () => store.approve(alice.id, name("bob"), "member")
    ]) {
      assert.throws(approve, AccountChangeRefusedError);
    }
    assert.deepEqual(requests(store), ["Carol"]);
  });

  test("denies a request and frees its username", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    store.requestAccess(name("Bob"), FIXED_HASH, 5);

    store.deny(alice.id, name("bob"));
    const bob = store.register(name("Bob"), FIXED_HASH);

    assert.equal(bob.pending, false);
    assert.deepEqual(requests(store), []);
  });

  test("refuses to deny for a non-admin or an active account", () => {
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    store.requestAccess(name("Carol"), FIXED_HASH, 5);

    for (const deny of [
      () => store.deny(bob.id, name("carol")),
      () => store.deny(alice.id, name("bob"))
    ]) {
      assert.throws(deny, AccountChangeRefusedError);
    }
    assert.equal(store.size, 3);
  });

  test("keeps role changes and removal away from a request", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    store.requestAccess(name("Bob"), FIXED_HASH, 5);

    for (const change of [
      () => store.assignRole(alice.id, name("bob"), "member"),
      () => store.remove(alice.id, name("bob"))
    ]) {
      assert.throws(change, AccountChangeRefusedError);
    }
    assert.deepEqual(requests(store), ["Bob"]);
  });
});
