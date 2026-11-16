// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AuthenticationRequest } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  OTHER_REALM,
  REALM,
  addMembership,
  createAccounts,
  createRealm,
  databaseWith,
  databaseWithRetiredRole,
  openSession
} from "./helpers/accounts.ts";
import { solidPng } from "./helpers/avatar/images.ts";
import { parseAgentProfile } from "#src/agent/AgentToken.ts";
import { Membership } from "#src/realm/Membership.ts";

function upgrade(
  cookie?: string,
  credential?: string
): AuthenticationRequest {
  return {
    clientId: "client",
    url: "/ws-sync",
    headers: {
      host: "studio.local",
      origin: "http://studio.local",
      ...(cookie === undefined ? {} : { cookie })
    },
    defaultRole: "spectator",
    credential
  };
}

describe("AccountsRealm.authenticate — share links", () => {
  test("identifies a share link token as a guest with a peer id per connection", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const link = realm.shareLinks.create({
      assetId: "map-1",
      createdBy: alice.id,
      expiresAt: null
    });

    const first = realm.authenticate(upgrade(undefined, link.token));
    const second = realm.authenticate(upgrade(undefined, link.token));

    assert.ok(first !== null && second !== null);
    assert.deepEqual(
      {
        ...first,
        profile: {
          ...first.profile,
          peerId: "<random>"
        }
      },
      {
        subject: `share:${link.id}`,
        role: "guest",
        profile: {
          username: "Guest",
          peerId: "<random>",
          avatar: null,
          via: "link"
        }
      }
    );
    assert.notEqual(first.profile?.peerId, second.profile?.peerId);
  });

  test("refuses a link of another realm, and an unknown token beside a valid session cookie", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const other = createRealm(accounts, {}, OTHER_REALM);
    const link = other.shareLinks.create({
      assetId: "map-1",
      createdBy: alice.id,
      expiresAt: null
    });
    const cookie = `jolly_session=${openSession(database, alice.id)}`;

    assert.equal(realm.authenticate(upgrade(undefined, link.token)), null);
    assert.equal(realm.authenticate(upgrade(cookie, "unknown")), null);
  });
});

describe("AccountsRealm.authenticate — agent tokens", () => {
  test("identifies an agent token by its name with the current role of its owner in the realm", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const { token, value } = realm.agentTokens.create({
      ownerId: bob.id,
      name: "Builder"
    });

    const identity = realm.authenticate(upgrade(undefined, value));

    assert.deepEqual(identity, {
      subject: `agent:${token.id}`,
      role: "spectator",
      profile: {
        username: "Builder",
        peerId: token.id,
        avatar: null,
        via: "golem",
        ownerId: bob.id
      }
    });
    const profile = identity?.profile ?? {};
    assert.deepEqual(parseAgentProfile(profile), {
      username: "Builder",
      peerId: token.id,
      via: "golem",
      ownerId: bob.id
    });
    assert.equal(parseAgentProfile({ ...profile, via: "link" }), null);

    addMembership(database, Membership.active(REALM, bob.id, "member"));

    assert.equal(
      realm.authenticate(upgrade(undefined, value))?.role,
      "member"
    );
  });

  test("refuses a revoked token and a token of another realm", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const other = createRealm(accounts, {}, OTHER_REALM);
    const { token, value } = realm.agentTokens.create({
      ownerId: alice.id
    });
    const otherToken = other.agentTokens.create({
      ownerId: alice.id
    });

    realm.agentTokens.revoke(alice.id, token.id);

    assert.equal(realm.authenticate(upgrade(undefined, value)), null);
    assert.equal(realm.authenticate(upgrade(undefined, otherToken.value)), null);
  });
});

describe("AccountsRealm.authenticate", () => {
  test("identifies the member of a session cookie and refuses an outsider", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const other = createRealm(accounts, {}, OTHER_REALM);

    assert.deepEqual(
      realm.authenticate(upgrade(`jolly_session=${openSession(database, alice.id)}`)),
      {
        subject: alice.id,
        role: "admin",
        profile: {
          username: "Alice",
          peerId: alice.id,
          avatar: null
        }
      }
    );
    assert.equal(realm.authenticate(upgrade()), null);
    assert.equal(
      other.authenticate(upgrade(`jolly_session=${openSession(database, bob.id)}`)),
      null
    );
  });

  test("points the profile at the uploaded avatar", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);
    const token = openSession(database, alice.id);
    const { avatar } = await accounts.replaceAvatar(alice.id, await solidPng(8, 8));

    assert.equal(
      realm.authenticate(upgrade(`jolly_session=${token}`))?.profile?.avatar,
      avatar
    );
  });

  test("connects a member whose role left the table with the default role", () => {
    using database = databaseWithRetiredRole();
    const [, bob] = database.accounts;
    using accounts = createAccounts(database);
    const realm = createRealm(accounts);

    assert.equal(
      realm.authenticate(upgrade(`jolly_session=${openSession(database, bob.id)}`))?.role,
      "spectator"
    );
  });
});
