// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createMembers,
  databaseWith,
  name,
  requestAccess
} from "../helpers/accounts.ts";
import type { MemberDirectory } from "#src/realm/MemberDirectory.ts";
import { AccountChangeRefusedError } from "#src/node.ts";

function requests(
  members: MemberDirectory
): string[] {
  return [...members.requests()].map((request) => request.username);
}

function usernames(
  members: MemberDirectory
): string[] {
  return [...members].map((member) => member.username);
}

describe("MemberDirectory access requests", () => {
  test("approves a request with the role an admin picks", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    requestAccess(database, "Bob");
    const members = createMembers(database);

    const approved = members.approve(alice.id, name("bob"), "member");

    assert.equal(approved.role, "member");
    assert.deepEqual(requests(members), []);
    assert.deepEqual(usernames(members), ["Alice", "Bob"]);
  });

  test("refuses to approve for a non-admin, an undeclared role or an active member", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    requestAccess(database, "Carol");
    const members = createMembers(database);

    for (const approve of [
      () => members.approve(bob.id, name("carol"), "member"),
      () => members.approve(alice.id, name("carol"), "editor"),
      () => members.approve(alice.id, name("bob"), "member")
    ]) {
      assert.throws(approve, AccountChangeRefusedError);
    }
    assert.deepEqual(requests(members), ["Carol"]);
  });

  test("denies a request and keeps the account", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const bob = requestAccess(database, "Bob");
    const members = createMembers(database);

    members.deny(alice.id, name("bob"));

    assert.deepEqual(requests(members), []);
    assert.deepEqual(usernames(members), ["Alice"]);
    assert.deepEqual(database.accounts.byId(bob.id), bob);
  });

  test("refuses to deny for a non-admin or an active member", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    requestAccess(database, "Carol");
    const members = createMembers(database);

    for (const deny of [
      () => members.deny(bob.id, name("carol")),
      () => members.deny(alice.id, name("bob"))
    ]) {
      assert.throws(deny, AccountChangeRefusedError);
    }
    assert.deepEqual(requests(members), ["Carol"]);
  });

  test("refuses a non-admin before telling whether a request exists", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const members = createMembers(database);

    for (const change of [
      () => members.approve(bob.id, name("nobody"), "member"),
      () => members.deny(bob.id, name("nobody"))
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
    const members = createMembers(database);

    for (const change of [
      () => members.assignRole(alice.id, name("bob"), "member"),
      () => members.remove(alice.id, name("bob")),
      () => members.transferOwnership(alice.id, name("bob"))
    ]) {
      assert.throws(change, {
        name: "AccountChangeRefusedError",
        message: "no member is named \"bob\""
      });
    }
    assert.deepEqual(requests(members), ["Bob"]);
  });
});
