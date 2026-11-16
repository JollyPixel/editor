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
  createMembers,
  createRealm,
  databaseWith,
  databaseWithRetiredRole,
  insertAgentToken,
  name,
  registration,
  requestAccess
} from "../helpers/accounts.ts";
import type { AccountActivity } from "#src/index.ts";
import {
  AccountChangeRefusedError,
  AccountRoles
} from "#src/node.ts";

describe("MemberDirectory activity", () => {
  test("reports each account change with the account that made it", async() => {
    const members = createMembers();
    const activities: AccountActivity[] = [];
    members.subscribe("activity", (activity) => activities.push(activity));

    await members.register(registration("Alice"), ADDRESS);
    await members.register(registration("Bob"), ADDRESS);
    await members.register(registration("Carol"), ADDRESS);
    const [alice] = members;
    members.approve(alice.id, name("bob"), "member");
    members.deny(alice.id, name("carol"));
    members.assignRole(alice.id, name("bob"), "spectator");
    members.transferOwnership(alice.id, name("bob"));

    const [, bob] = members;
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
    const realm = createRealm(accounts);
    const activities: AccountActivity[] = [];
    realm.watchActivity((activity) => activities.push(activity));

    const link = realm.shareLinks.create({
      assetId: "asset-a",
      createdBy: bob.id,
      expiresAt: null
    });
    realm.shareLinks.revoke(alice.id, link.id);

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

  test("reports the agent tokens an account creates and revokes", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const activities: AccountActivity[] = [];
    realm.watchActivity((activity) => activities.push(activity));

    const { token } = realm.agentTokens.create({
      ownerId: alice.id,
      name: "Builder"
    });
    realm.agentTokens.revoke(alice.id, token.id);

    assert.deepEqual(activities, [
      {
        type: "agent-token-created",
        actorId: alice.id,
        tokenId: token.id,
        name: "Builder"
      },
      {
        type: "agent-token-revoked",
        actorId: alice.id,
        tokenId: token.id,
        name: "Builder"
      }
    ]);
  });
});

describe("MemberDirectory.replaceRoles", () => {
  test("declares the new roles and reads a retired one as the new default", () => {
    using database = databaseWithRetiredRole();
    const [alice, bob] = database.accounts;
    const members = createMembers(database);
    let changes = 0;
    members.subscribe("changed", () => changes++);

    members.replaceRoles(new AccountRoles({
      roles: ["editor", "viewer"],
      defaultRole: "viewer"
    }));
    members.assignRole(alice.id, name("bob"), "viewer");

    assert.equal(changes, 2);
    assert.equal(members.member(bob.id)?.role, "viewer");
    assert.deepEqual([...members.roles], ["admin", "editor", "viewer"]);
  });

  test("moves the members and requests of a renamed role and revokes them with their agents", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const bobAgent = insertAgentToken(database, bob.id);
    const carol = requestAccess(database, "Carol");
    const members = createMembers(database);
    const revoked: string[] = [];
    let changes = 0;
    members.subscribe("revoked", (subject) => revoked.push(subject));
    members.subscribe("changed", () => changes++);

    members.replaceRoles(
      new AccountRoles({
        roles: ["member", "viewer"],
        defaultRole: "viewer"
      }),
      new Map([["spectator", "viewer"]])
    );

    assert.deepEqual(members.holders("viewer"), [bob.id, carol.id]);
    assert.equal(members.member(alice.id)?.role, "admin");
    assert.deepEqual(revoked, [bob.id, `agent:${bobAgent.id}`, carol.id]);
    assert.equal(changes, 1);
  });

  test("refuses a rename from a declared role or to an undeclared one", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const members = createMembers(database);
    const roles = new AccountRoles({
      roles: ["member", "spectator"],
      defaultRole: "member"
    });

    assert.throws(
      () => members.replaceRoles(roles, new Map([["spectator", "member"]])),
      AccountChangeRefusedError
    );
    assert.throws(
      () => members.replaceRoles(roles, new Map([["editor", "viewer"]])),
      AccountChangeRefusedError
    );
    assert.equal(members.member(bob.id)?.role, "spectator");
    assert.equal(members.roles.has("viewer"), false);
  });
});

describe("MemberDirectory.replaceJoin", () => {
  test("applies the new policy to the next registration", async() => {
    using database = databaseWith("Alice");
    const members = createMembers(database);

    members.replaceJoin("open");
    const result = await members.register(registration("Bob"), ADDRESS);

    assert.equal(members.join, "open");
    assert.equal(result.status, "active");
  });
});

describe("MemberDirectory.holders", () => {
  test("lists the members and requests of the realm that store a role", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const carol = requestAccess(database, "Carol");
    const members = createMembers(database);

    assert.deepEqual(members.holders("spectator"), [bob.id, carol.id]);
    assert.deepEqual(members.holders("member"), []);
  });
});
