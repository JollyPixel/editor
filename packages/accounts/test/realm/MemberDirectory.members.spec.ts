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
  addMembership,
  createMembers,
  databaseWith,
  insertAgentToken,
  insertShareLink,
  name,
  registration
} from "../helpers/accounts.ts";
import { agentTokenSubject } from "#src/agent/AgentToken.ts";
import { Membership } from "#src/realm/Membership.ts";
import { shareLinkSubject } from "#src/share/ShareLinks.ts";
import { AccountChangeRefusedError } from "#src/node.ts";

describe("MemberDirectory.remove", () => {
  test("drops the membership in its realm and keeps the account and its other memberships", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "member"));
    const members = createMembers(database);

    members.remove(alice.id, name("BOB"));

    assert.equal(members.member(bob.id), null);
    assert.equal(database.accounts.size, 2);
    assert.equal(database.memberships.find(OTHER_REALM, bob.id)?.role, "member");
  });

  test("deletes the realm's share links and agent tokens of the removed member", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    insertAgentToken(database, bob.id);
    const otherAgent = insertAgentToken(database, bob.id, OTHER_REALM);
    insertShareLink(database, REALM, bob.id);
    const otherLink = insertShareLink(database, OTHER_REALM, bob.id);
    const members = createMembers(database);

    members.remove(alice.id, name("bob"));

    assert.deepEqual(database.agentTokens.ownedBy(REALM, bob.id), []);
    assert.deepEqual(database.agentTokens.ownedBy(OTHER_REALM, bob.id), [otherAgent]);
    assert.deepEqual(database.shareLinks.live(REALM, Date.now()), []);
    assert.deepEqual(database.shareLinks.live(OTHER_REALM, Date.now()), [otherLink]);
  });

  test("refuses an actor that is not an admin, and the owner", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob] = database.accounts;
    const members = createMembers(database);

    assert.throws(
      () => members.remove(bob.id, name("carol")),
      AccountChangeRefusedError
    );
    assert.throws(
      () => members.remove(alice.id, name("alice")),
      AccountChangeRefusedError
    );
    assert.equal([...members].length, 3);
  });
});

describe("MemberDirectory changes", () => {
  test("emits changed after a registration, a role change and a removal", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const members = createMembers(database, { join: "open" });
    let changes = 0;
    members.on("changed", () => {
      changes++;
    });

    await members.register(registration("Bob"), ADDRESS);
    members.assignRole(alice.id, name("bob"), "member");
    members.remove(alice.id, name("bob"));

    assert.equal(changes, 3);
  });

  test("emits nothing for a refused role change", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice] = database.accounts;
    const members = createMembers(database);
    let changes = 0;
    members.on("changed", () => {
      changes++;
    });

    assert.throws(
      () => members.assignRole(alice.id, name("bob"), "editor"),
      AccountChangeRefusedError
    );
    assert.equal(changes, 0);
  });

  test("revokes the member and its agents on a role change, a removal and a transfer", () => {
    using database = databaseWith("Alice", "Bob", "Carol", "Dave");
    const [alice, bob, carol, dave] = database.accounts;
    const bobAgent = insertAgentToken(database, bob.id);
    insertAgentToken(database, bob.id, OTHER_REALM);
    const daveAgent = insertAgentToken(database, dave.id);
    const members = createMembers(database);
    const revoked: string[] = [];
    const stop = members.subscribe("revoked", (subject) => revoked.push(subject));

    members.assignRole(alice.id, name("bob"), "member");
    members.remove(alice.id, name("bob"));
    const owner = members.transferOwnership(alice.id, name("dave"));
    stop();
    members.remove(alice.id, name("carol"));

    assert.deepEqual(revoked, [
      bob.id,
      `agent:${bobAgent.id}`,
      bob.id,
      `agent:${bobAgent.id}`,
      dave.id,
      `agent:${daveAgent.id}`
    ]);
    assert.equal(owner.owner, true);
    assert.equal(members.member(carol.id), null);
  });
});

describe("MemberDirectory.invite", () => {
  test("makes an account a member, or approves its pending request, with the role", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob, carol] = database.accounts;
    addMembership(database, Membership.request(OTHER_REALM, carol.id, "member"));
    const members = createMembers(database, { realmId: OTHER_REALM });

    members.invite(alice.id, name("bob"), "member");
    members.invite(alice.id, name("carol"), "spectator");

    assert.equal(members.member(bob.id)?.role, "member");
    assert.equal(members.member(carol.id)?.role, "spectator");
    assert.throws(
      () => members.invite(alice.id, name("bob"), "spectator"),
      /already a member/
    );
  });

  test("refuses an actor that is not an admin, and an unknown account", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const members = createMembers(database, { realmId: OTHER_REALM });

    assert.throws(
      () => members.invite(bob.id, name("bob"), "member"),
      AccountChangeRefusedError
    );
    assert.throws(
      () => members.invite(alice.id, name("dave"), "member"),
      AccountChangeRefusedError
    );
  });
});

describe("MemberDirectory.deleteAccount", () => {
  test("lets the owner delete an account everywhere, revoking it, its links and its agents", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "member"));
    const token = insertAgentToken(database, bob.id, OTHER_REALM);
    const link = insertShareLink(database, REALM, bob.id);
    const members = createMembers(database);
    const revoked: string[] = [];
    members.on("revoked", (subject) => revoked.push(subject));

    members.deleteAccount(alice.id, name("bob"));

    assert.equal(database.accounts.size, 1);
    assert.equal(database.memberships.find(OTHER_REALM, bob.id), null);
    assert.deepEqual(revoked.sort(), [
      agentTokenSubject(token.id),
      bob.id,
      shareLinkSubject(link.id)
    ].sort());
  });

  test("refuses an admin who does not own the server", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob] = database.accounts;
    const members = createMembers(database);
    members.assignRole(alice.id, name("bob"), "admin");

    assert.throws(
      () => members.deleteAccount(bob.id, name("carol")),
      AccountChangeRefusedError
    );
    assert.equal(database.accounts.size, 3);
  });
});
