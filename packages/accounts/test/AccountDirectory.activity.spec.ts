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
  databaseWith,
  databaseWithRetiredRole,
  name,
  registration,
  requestAccess
} from "./helpers/accounts.ts";
import type { AccountActivity } from "#src/index.ts";
import {
  AccountChangeRefusedError,
  AccountRoles
} from "#src/node.ts";

// CONSTANTS
const kMasterPassword = {
  secret: "open sesame",
  accessRequests: true
};

describe("AccountDirectory activity", () => {
  test("reports each account change with the account that made it", async() => {
    const directory = createDirectory(undefined, {
      masterPassword: kMasterPassword
    });
    const activities: AccountActivity[] = [];
    directory.subscribe("activity", (activity) => activities.push(activity));

    await directory.register(registration("Alice", "open sesame"), ADDRESS);
    await directory.register(registration("Bob"), ADDRESS);
    await directory.register(registration("Carol"), ADDRESS);
    const [alice] = directory;
    directory.approve(alice.id, name("bob"), "member");
    directory.deny(alice.id, name("carol"));
    directory.assignRole(alice.id, name("bob"), "spectator");
    directory.transferOwnership(alice.id, name("bob"));

    const [, bob] = directory;
    assert.deepEqual(
      activities.map(({ type }) => type),
      [
        "registered",
        "registered",
        "registered",
        "approved",
        "denied",
        "role-changed",
        "owner-transferred"
      ]
    );
    assert.deepEqual(
      activities.slice(3).map(({ actorId }) => actorId),
      [alice.id, alice.id, alice.id, alice.id]
    );
    assert.deepEqual(activities[1], {
      type: "registered",
      actorId: bob.id,
      accountId: bob.id,
      username: "Bob",
      pending: true
    });
    assert.deepEqual(activities[5], {
      type: "role-changed",
      actorId: alice.id,
      accountId: bob.id,
      username: "Bob",
      from: "member",
      to: "spectator"
    });
  });

  test("reports the share links an account creates and revokes", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    using accounts = createAccounts(database);
    const activities: AccountActivity[] = [];
    accounts.watchActivity((activity) => activities.push(activity));

    const link = accounts.shareLinks.create({
      assetId: "asset-a",
      createdBy: bob.id,
      expiresAt: null
    });
    accounts.shareLinks.revoke(alice.id, link.id);

    assert.deepEqual(activities, [
      {
        type: "share-link-created",
        actorId: bob.id,
        linkId: link.id,
        assetId: "asset-a"
      },
      {
        type: "share-link-revoked",
        actorId: alice.id,
        linkId: link.id,
        assetId: "asset-a"
      }
    ]);
  });
});

describe("AccountDirectory.replaceRoles", () => {
  test("declares the new roles and reads a retired one as the new default", () => {
    using database = databaseWithRetiredRole();
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);
    let changes = 0;
    directory.subscribe("changed", () => changes++);

    directory.replaceRoles(new AccountRoles({
      roles: ["editor", "viewer"],
      defaultRole: "viewer"
    }));
    directory.assignRole(alice.id, name("bob"), "viewer");

    assert.equal(changes, 2);
    assert.equal(directory.account(bob.id)?.role, "viewer");
    assert.deepEqual([...directory.roles], ["admin", "editor", "viewer"]);
  });

  test("moves the accounts and requests of a renamed role and revokes them", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const carol = requestAccess(database, "Carol");
    const directory = createDirectory(database);
    const revoked: string[] = [];
    let changes = 0;
    directory.subscribe("revoked", (subject) => revoked.push(subject));
    directory.subscribe("changed", () => changes++);

    directory.replaceRoles(
      new AccountRoles({
        roles: ["member", "viewer"],
        defaultRole: "viewer"
      }),
      new Map([["spectator", "viewer"]])
    );

    assert.deepEqual(directory.holders("viewer"), [bob.id, carol.id]);
    assert.equal(directory.account(alice.id)?.role, "admin");
    assert.deepEqual(revoked, [bob.id, carol.id]);
    assert.equal(changes, 1);
  });

  test("refuses a rename from a declared role or to an undeclared one", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const directory = createDirectory(database);
    const roles = new AccountRoles({
      roles: ["member", "spectator"],
      defaultRole: "member"
    });

    assert.throws(
      () => directory.replaceRoles(roles, new Map([["spectator", "member"]])),
      AccountChangeRefusedError
    );
    assert.throws(
      () => directory.replaceRoles(roles, new Map([["editor", "viewer"]])),
      AccountChangeRefusedError
    );
    assert.equal(directory.account(bob.id)?.role, "spectator");
    assert.equal(directory.roles.has("viewer"), false);
  });
});

describe("AccountDirectory.replaceAccessRequests", () => {
  test("turns a registration without the master password into an active account", async() => {
    using database = databaseWith("Alice");
    const directory = createDirectory(database, {
      masterPassword: kMasterPassword
    });

    directory.replaceAccessRequests(false);
    const result = await directory.register(registration("Bob"), ADDRESS);

    assert.equal(directory.accessRequests, false);
    assert.equal(result.status, "active");
  });

  test("refuses to turn them on without a master password", () => {
    const directory = createDirectory();

    assert.throws(() => directory.replaceAccessRequests(true), TypeError);
    assert.equal(directory.accessRequests, false);
  });
});

describe("AccountDirectory.holders", () => {
  test("lists the accounts and requests that store a role", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const carol = requestAccess(database, "Carol");
    const directory = createDirectory(database);

    assert.deepEqual(directory.holders("spectator"), [bob.id, carol.id]);
    assert.deepEqual(directory.holders("member"), []);
  });
});
