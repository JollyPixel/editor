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
  createStore,
  name,
  storeWith
} from "./helpers/accounts.ts";
import {
  AccountChangeRefusedError,
  SessionCookie
} from "#src/node.ts";
import { PasswordDigest } from "#src/session/PasswordDigest.ts";

// CONSTANTS
const kPassword = PasswordDigest.parse("p".repeat(43));
const kWrongPassword = PasswordDigest.parse("w".repeat(43));

function upgrade(
  headers: Record<string, string>
): AuthenticationRequest {
  return {
    clientId: "client",
    url: "/ws-sync",
    headers: {
      host: "studio.local",
      ...headers
    },
    defaultRole: "spectator"
  };
}

describe("Accounts sessions", () => {
  test("opens a session on register and on login with the same password", async() => {
    using accounts = createAccounts();

    const registered = await accounts.register(name("Alice"), kPassword);
    const logged = await accounts.login(name("alice"), kPassword);

    assert.deepEqual(logged?.account, registered.account);
    assert.deepEqual(accounts.accountForToken(registered.token), registered.account);
  });

  test("refuses a wrong password and an unknown username alike", async() => {
    using accounts = createAccounts();
    await accounts.register(name("Alice"), kPassword);

    assert.equal(await accounts.login(name("Alice"), kWrongPassword), null);
    assert.equal(await accounts.login(name("Nobody"), kPassword), null);
  });

  test("reads an undeclared role as the default role", async() => {
    using store = createStore();
    using accounts = createAccounts(store);
    await accounts.register(name("Alice"), kPassword);
    const bob = await accounts.register(name("Bob"), kPassword);
    store.assignRole(name("bob"), "editor");

    assert.equal(accounts.accountForToken(bob.token)?.role, "spectator");
    assert.equal(accounts.accountById(bob.account.id)?.role, "spectator");
    assert.deepEqual(
      [...accounts].map((account) => account.role),
      ["admin", "spectator"]
    );
  });

  test("closes a session on logout", async() => {
    using accounts = createAccounts();
    const { token } = await accounts.register(name("Alice"), kPassword);

    accounts.logout(token);

    assert.equal(accounts.accountForToken(token), null);
  });
});

describe("Accounts changes", () => {
  test("emits changed after a registration, a role change and a removal", async() => {
    using accounts = createAccounts(storeWith("Alice"));
    let changes = 0;
    accounts.on("changed", () => {
      changes++;
    });

    await accounts.register(name("Bob"), kPassword);
    accounts.assignRole(name("bob"), "member");
    accounts.remove(name("bob"));

    assert.equal(changes, 3);
  });

  test("refuses an undeclared role without touching the account", () => {
    using accounts = createAccounts(storeWith("Alice", "Bob"));
    let changes = 0;
    accounts.on("changed", () => {
      changes++;
    });

    assert.throws(
      () => accounts.assignRole(name("bob"), "editor"),
      AccountChangeRefusedError
    );
    assert.deepEqual(
      [...accounts].map((account) => account.role),
      ["admin", "spectator"]
    );
    assert.equal(changes, 0);
  });
});

describe("Accounts.authenticate", () => {
  test("identifies the account of a same-origin upgrade", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    using accounts = createAccounts(store);

    assert.deepEqual(
      accounts.authenticate(upgrade({
        origin: "http://studio.local",
        cookie: `theme=dark; jolly_session=${store.openSession(alice.id)}`
      })),
      {
        subject: alice.id,
        role: "admin",
        profile: {
          username: "Alice",
          peerId: alice.id
        }
      }
    );
  });

  test("ignores the cookie of an upgrade from another origin", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    using accounts = createAccounts(store);

    assert.equal(
      accounts.authenticate(upgrade({
        origin: "http://evil.example",
        cookie: `jolly_session=${store.openSession(alice.id)}`
      })),
      null
    );
  });

  test("reads only the cookie it is configured with", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    using accounts = createAccounts(store, {
      cookie: new SessionCookie("project_session")
    });
    const token = store.openSession(alice.id);

    assert.equal(
      accounts.authenticate(upgrade({ cookie: `jolly_session=${token}` })),
      null
    );
    assert.notEqual(
      accounts.authenticate(upgrade({ cookie: `project_session=${token}` })),
      null
    );
  });

  test("refuses an upgrade without a cookie, or with a malformed or closed token", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const token = store.openSession(alice.id);
    store.closeSession(token);
    using accounts = createAccounts(store);

    assert.equal(accounts.authenticate(upgrade({})), null);
    assert.equal(accounts.authenticate(upgrade({ cookie: `jolly_session=${token}` })), null);
    assert.equal(accounts.authenticate(upgrade({ cookie: "jolly_session=hunter2" })), null);
  });

  test("connects an account whose role left the table with the default role", () => {
    using store = storeWith("Alice", "Bob");
    store.assignRole(name("bob"), "editor");
    const [, bob] = store;
    using accounts = createAccounts(store);

    assert.equal(
      accounts.authenticate(upgrade({
        cookie: `jolly_session=${store.openSession(bob.id)}`
      }))?.role,
      "spectator"
    );
  });
});
