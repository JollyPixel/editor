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
  createAccounts,
  databaseWith,
  databaseWithRetiredRole,
  sessionFor
} from "./helpers/accounts.ts";
import { listenAccounts } from "./helpers/accountsServer.ts";
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
    await using server = await listenAccounts(accounts);
    const { client, cookies } = server.browser();
    const token = sessionFor(database, alice.id);
    cookies.set("jolly_session", token);
    const { avatar } = await client.replaceAvatar(
      new Blob([await solidPng(8, 8)], { type: "image/png" })
    );

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
    await using server = await listenAccounts(accounts);
    const { client, cookies } = server.browser();
    cookies.set("jolly_session", sessionFor(database, alice.id));
    const revoked: string[] = [];
    const stop = accounts.watchRevocations((accountId) => revoked.push(accountId));

    await client.logout();
    stop();

    assert.deepEqual(revoked, [alice.id]);
  });
});

describe("Accounts.watchProfiles", () => {
  test("reports the profile of an account whose avatar changed, until stopped", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    using accounts = createAccounts(database);
    await using server = await listenAccounts(accounts);
    const { client, cookies } = server.browser();
    cookies.set("jolly_session", sessionFor(database, alice.id));
    const changes: [string, PeerMetadata][] = [];
    const stop = accounts.watchProfiles(
      (accountId, profile) => changes.push([accountId, profile])
    );

    const { avatar } = await client.replaceAvatar(
      new Blob([await solidPng(8, 8)], { type: "image/png" })
    );
    stop();
    await client.replaceAvatar(
      new Blob([await solidPng(4, 4)], { type: "image/png" })
    );

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
