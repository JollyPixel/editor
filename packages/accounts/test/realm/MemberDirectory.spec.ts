// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  OTHER_REALM,
  REALM,
  activeAccount,
  addMembership,
  createMembers,
  databaseWith,
  databaseWithRetiredRole,
  name,
  registration
} from "../helpers/accounts.ts";
import type { MemberDirectory } from "#src/realm/MemberDirectory.ts";
import { Membership } from "#src/realm/Membership.ts";
import {
  AccessRequestsFullError,
  AccountChangeRefusedError,
  AccountPendingError,
  InvitationRequiredError,
  MembershipRequiredError,
  UsernameTakenError
} from "#src/node.ts";

function roles(
  members: MemberDirectory
): string[] {
  return [...members].map(
    ({ username, role, owner }) => `${username}:${role}${owner ? ":owner" : ""}`
  );
}

describe("MemberDirectory.register", () => {
  test("makes the first account the admin owner without a membership, and later ones members", async() => {
    using database = databaseWith();
    const members = createMembers(database, { join: "open" });

    const alice = await activeAccount(members.register(registration("Alice"), ADDRESS));
    await activeAccount(members.register(registration("Bob"), ADDRESS));

    assert.deepEqual(roles(members), ["Alice:admin:owner", "Bob:spectator"]);
    assert.equal(database.memberships.find(REALM, alice.id), null);
  });

  test("keeps a registration pending under the request policy", async() => {
    using database = databaseWith("Alice");
    const members = createMembers(database, { join: "request" });

    assert.deepEqual(
      await members.register(registration("Bob"), ADDRESS),
      { status: "pending" }
    );
    assert.deepEqual(roles(members), ["Alice:admin:owner"]);
    assert.deepEqual(
      [...members.requests()].map(({ username }) => username),
      ["Bob"]
    );
  });

  test("refuses to create any account under the invite policy, but the first one", async() => {
    using database = databaseWith();
    const members = createMembers(database, { join: "invite" });

    await activeAccount(members.register(registration("Alice"), ADDRESS));
    await assert.rejects(
      members.register(registration("Bob"), ADDRESS),
      InvitationRequiredError
    );

    assert.equal(database.accounts.size, 1);
  });

  test("refuses a request once requests reach their limit, and creates no account", async() => {
    using database = databaseWith("Alice");
    const members = createMembers(database, { maxRequests: 1 });

    await members.register(registration("Bob"), ADDRESS);
    await assert.rejects(
      members.register(registration("Carol"), ADDRESS),
      AccessRequestsFullError
    );

    assert.equal(database.accounts.size, 2);
  });

  test("refuses a username taken in any realm", async() => {
    using database = databaseWith("Alice");
    const members = createMembers(database, {
      join: "open",
      realmId: OTHER_REALM
    });

    await assert.rejects(
      members.register(registration("aLICE"), ADDRESS),
      UsernameTakenError
    );
    assert.equal(database.accounts.size, 1);
  });

  test("reads a role that is no longer declared as the default role", () => {
    using database = databaseWithRetiredRole();
    const [, bob] = database.accounts;
    const members = createMembers(database);

    assert.equal(members.member(bob.id)?.role, "spectator");
    assert.deepEqual(roles(members), ["Alice:admin:owner", "Bob:spectator"]);
  });
});

describe("MemberDirectory.admit", () => {
  test("admits the owner and active members, and refuses a request or an outsider", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const members = createMembers(database, { realmId: OTHER_REALM });

    assert.equal(members.admit(alice.id).role, "admin");
    assert.throws(() => members.admit(bob.id), MembershipRequiredError);
    addMembership(database, Membership.request(OTHER_REALM, bob.id, "member"));
    assert.throws(() => members.admit(bob.id), AccountPendingError);
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "member"));
    assert.equal(members.admit(bob.id).role, "member");
  });
});

describe("MemberDirectory.assignRole", () => {
  test("changes the role in its realm only", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "spectator"));
    const members = createMembers(database);

    members.assignRole(alice.id, name("bob"), "member");

    assert.equal(members.member(bob.id)?.role, "member");
    assert.equal(database.memberships.find(OTHER_REALM, bob.id)?.role, "spectator");
  });

  test("refuses a role that is not declared", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice] = database.accounts;
    const members = createMembers(database);

    assert.throws(
      () => members.assignRole(alice.id, name("bob"), "editor"),
      {
        name: "AccountChangeRefusedError",
        message: "\"editor\" is not a role"
      }
    );
    assert.deepEqual(roles(members), ["Alice:admin:owner", "Bob:spectator"]);
  });

  test("refuses an actor that is not an admin of the realm or does not exist", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [, bob] = database.accounts;
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "admin"));
    const members = createMembers(database);

    for (const actorId of [bob.id, "nobody"]) {
      assert.throws(
        () => members.assignRole(actorId, name("carol"), "member"),
        AccountChangeRefusedError
      );
    }
    assert.deepEqual(
      roles(members),
      ["Alice:admin:owner", "Bob:spectator", "Carol:spectator"]
    );
  });

  test("refuses an account that is not a member of the realm", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice] = database.accounts;
    const members = createMembers(database, { realmId: OTHER_REALM });

    assert.throws(
      () => members.assignRole(alice.id, name("bob"), "member"),
      {
        name: "AccountChangeRefusedError",
        message: "no member is named \"bob\""
      }
    );
  });

  test("refuses to change the role of the owner, even for the owner", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const members = createMembers(database);
    members.assignRole(alice.id, name("bob"), "admin");

    for (const actor of [alice, bob]) {
      assert.throws(
        () => members.assignRole(actor.id, name("alice"), "member"),
        {
          name: "AccountChangeRefusedError",
          message: "\"Alice\" is the owner"
        }
      );
    }
    assert.equal(
      members.assignRole(bob.id, name("bob"), "member").role,
      "member"
    );
  });
});
