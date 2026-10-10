// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  AuthenticationRequest,
  PeerMetadata
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  ADDRESS,
  createAccounts,
  databaseWith,
  databaseWithRetiredRole,
  sessionFor
} from "./helpers/accounts.ts";
import { solidPng } from "./helpers/avatar/images.ts";

function upgrade(
  cookie?: string
): AuthenticationRequest {
  return {
    clientId: "client",
    url: "/ws-sync",
    headers: {
      host: "studio.local",
      origin: "http://studio.local",
      ...(cookie === undefined ? {} : { cookie })
    },
    defaultRole: "spectator"
  };
}

describe("Accounts.authenticate", () => {
  test("identifies the account of a session cookie", () => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);

    assert.deepEqual(
      accounts.authenticate(upgrade(`jolly_session=${sessionFor(database, alice.id)}`)),
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
    assert.equal(accounts.authenticate(upgrade()), null);
  });

  test("points the profile at the uploaded avatar", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const token = sessionFor(database, alice.id);
    const { avatar } = await accounts.replaceAvatar(alice.id, await solidPng(8, 8));

    assert.equal(
      accounts.authenticate(upgrade(`jolly_session=${token}`))?.profile?.avatar,
      avatar
    );
  });

  test("connects an account whose role left the table with the default role", () => {
    using database = databaseWithRetiredRole();
    const [, bob] = database.accounts;
    using accounts = createAccounts(database);

    assert.equal(
      accounts.authenticate(upgrade(`jolly_session=${sessionFor(database, bob.id)}`))?.role,
      "spectator"
    );
  });
});

describe("Accounts.watchRevocations", () => {
  test("revokes the account that signs out", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const revoked: string[] = [];
    const stop = accounts.watchRevocations((accountId) => revoked.push(accountId));

    accounts.signOut({
      address: ADDRESS,
      secure: false,
      headers: {
        cookie: `jolly_session=${sessionFor(database, alice.id)}`
      }
    });
    stop();

    assert.deepEqual(revoked, [alice.id]);
  });
});

describe("Accounts.watchProfiles", () => {
  test("reports the profile of an account whose avatar changed, until stopped", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    const changes: [string, PeerMetadata][] = [];
    const stop = accounts.watchProfiles(
      (accountId, profile) => changes.push([accountId, profile])
    );

    const { avatar } = await accounts.replaceAvatar(alice.id, await solidPng(8, 8));
    stop();
    await accounts.replaceAvatar(alice.id, await solidPng(4, 4));

    assert.deepEqual(changes, [[
      alice.id,
      {
        username: "Alice",
        peerId: alice.id,
        avatar
      }
    ]]);
  });
});
