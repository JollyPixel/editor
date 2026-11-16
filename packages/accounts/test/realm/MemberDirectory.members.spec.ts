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
import { Membership } from "#src/realm/Membership.ts";
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
