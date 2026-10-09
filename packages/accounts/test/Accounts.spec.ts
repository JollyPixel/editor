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
  createAccounts,
  sessionFor,
  storeWith,
  storeWithRetiredRole
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
    using store = storeWith("Alice");
    const [alice] = store;
    using accounts = createAccounts(store);

    assert.deepEqual(
      accounts.authenticate(upgrade(`jolly_session=${sessionFor(store, alice.id)}`)),
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
    using store = storeWith("Alice");
    const [alice] = store;
    using accounts = createAccounts(store);
    await using server = await listenAccounts(accounts);
    const { client, cookies } = server.browser();
    const token = sessionFor(store, alice.id);
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
    using store = storeWithRetiredRole();
    const [, bob] = store;
    using accounts = createAccounts(store);

    assert.equal(
      accounts.authenticate(upgrade(`jolly_session=${sessionFor(store, bob.id)}`))?.role,
      "spectator"
    );
  });
});

describe("Accounts.watchRevocations", () => {
  test("revokes the account that signs out", async() => {
    using store = storeWith("Alice");
    const [alice] = store;
    using accounts = createAccounts(store);
    await using server = await listenAccounts(accounts);
    const { client, cookies } = server.browser();
    cookies.set("jolly_session", sessionFor(store, alice.id));
    const revoked: string[] = [];
    const stop = accounts.watchRevocations((accountId) => revoked.push(accountId));

    await client.logout();
    stop();

    assert.deepEqual(revoked, [alice.id]);
  });
});
