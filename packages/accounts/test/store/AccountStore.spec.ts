// Import Node.js Dependencies
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  FIXED_HASH,
  ROLES,
  createStore,
  name,
  storeWith,
  storeWithRetiredRole
} from "../helpers/accounts.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import {
  AccountChangeRefusedError,
  AccountStore,
  UsernameTakenError
} from "#src/node.ts";

// CONSTANTS
const kNever = Number.MAX_SAFE_INTEGER;

describe("AccountStore.register", () => {
  test("makes the first account an admin and later ones the default role", () => {
    using store = createStore();

    const first = store.register(name("Alice"), FIXED_HASH);
    const second = store.register(name("bob"), FIXED_HASH);

    assert.equal(first.role, "admin");
    assert.equal(second.role, "spectator");
    assert.deepEqual([...store], [first, second]);
  });

  test("refuses a username that differs only by case", () => {
    using store = storeWith("Alice");

    assert.throws(
      () => store.register(name("aLICE"), FIXED_HASH),
      UsernameTakenError
    );
    assert.equal(store.size, 1);
  });

  test("returns the stored credentials under any casing", () => {
    using store = storeWith("Alice");

    const credentials = store.credentials(name("ALICE"));

    assert.equal(credentials?.account.username, "Alice");
    assert.deepEqual(credentials?.hash, FIXED_HASH);
    assert.equal(store.credentials(name("carol")), null);
  });
});

describe("AccountStore roles", () => {
  test("reads a role that is no longer declared as the default role", () => {
    using store = storeWithRetiredRole();
    const [, bob] = store;

    assert.equal(bob.role, "spectator");
    assert.equal(store.accountById(bob.id)?.role, "spectator");
    assert.equal(store.credentials(name("bob"))?.account.role, "spectator");
  });
});

describe("AccountStore sessions", () => {
  test("resolves an open session to its account until it is closed", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    const token = SessionToken.mint();

    store.openSession(token, alice.id, kNever);
    assert.equal(store.sessionOwner(token), alice.id);

    assert.equal(store.closeSession(token), alice.id);
    assert.equal(store.sessionOwner(token), null);
    assert.equal(store.closeSession(token), null);
  });

  test("ends a session at its expiry", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    using store = storeWith("Alice");
    const [alice] = store;
    const token = SessionToken.mint();
    store.openSession(token, alice.id, 1_000);

    t.mock.timers.tick(999);
    assert.equal(store.sessionOwner(token), alice.id);

    t.mock.timers.tick(1);
    assert.equal(store.sessionOwner(token), null);
  });

  test("rejects a token it never minted while another session is open", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    store.openSession(SessionToken.mint(), alice.id, kNever);

    assert.equal(store.sessionOwner(SessionToken.mint()), null);
  });
});

describe("AccountStore.assignRole", () => {
  test("changes the role of an account", () => {
    using store = storeWith("Alice", "Bob");
    const [alice] = store;

    const bob = store.assignRole(alice.id, name("bob"), "member");

    assert.equal(bob.role, "member");
    assert.deepEqual(
      [...store].map((account) => account.role),
      ["admin", "member"]
    );
  });

  test("refuses a role that is not declared", () => {
    using store = storeWith("Alice", "Bob");
    const [alice] = store;

    assert.throws(
      () => store.assignRole(alice.id, name("bob"), "editor"),
      {
        name: "AccountChangeRefusedError",
        message: "\"editor\" is not a role"
      }
    );
    assert.deepEqual(
      [...store].map((account) => account.role),
      ["admin", "spectator"]
    );
  });

  test("refuses an actor that is not an admin", () => {
    using store = storeWith("Alice", "Bob", "Carol");
    const [, bob] = store;

    assert.throws(
      () => store.assignRole(bob.id, name("carol"), "member"),
      {
        name: "AccountChangeRefusedError",
        message: "only an admin manages accounts"
      }
    );
    assert.throws(
      () => store.assignRole("nobody", name("carol"), "member"),
      AccountChangeRefusedError
    );
  });

  test("refuses to demote the last admin", () => {
    using store = storeWith("Alice", "Bob");
    const [alice] = store;

    assert.throws(
      () => store.assignRole(alice.id, name("alice"), "member"),
      AccountChangeRefusedError
    );

    store.assignRole(alice.id, name("bob"), "admin");
    assert.equal(
      store.assignRole(alice.id, name("alice"), "member").role,
      "member"
    );
  });

  test("refuses an unknown account", () => {
    using store = storeWith("Alice");
    const [alice] = store;

    assert.throws(
      () => store.assignRole(alice.id, name("carol"), "member"),
      AccountChangeRefusedError
    );
  });
});

describe("AccountStore.remove", () => {
  test("deletes the account and closes its sessions", () => {
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    const token = SessionToken.mint();
    store.openSession(token, bob.id, kNever);

    store.remove(alice.id, name("BOB"));

    assert.equal(store.sessionOwner(token), null);
    assert.equal(store.credentials(name("bob")), null);
    assert.equal(store.size, 1);
  });

  test("refuses an actor that is not an admin", () => {
    using store = storeWith("Alice", "Bob", "Carol");
    const [, bob] = store;

    assert.throws(
      () => store.remove(bob.id, name("carol")),
      AccountChangeRefusedError
    );
    assert.equal(store.size, 3);
  });

  test("refuses to remove the last admin", () => {
    using store = storeWith("Alice");
    const [alice] = store;

    assert.throws(
      () => store.remove(alice.id, name("alice")),
      AccountChangeRefusedError
    );
    assert.equal(store.size, 1);
  });
});

describe("AccountStore avatars", () => {
  const kAvatar = {
    hash: "0123456789abcdef",
    bytes: new Uint8Array([1, 2, 3])
  };

  test("stores an avatar and names its hash on every read of the account", () => {
    using store = storeWith("Alice");
    const [alice] = store;

    const updated = store.replaceAvatar(alice.id, kAvatar);

    assert.equal(updated.avatarHash, kAvatar.hash);
    assert.deepEqual(store.accountById(alice.id), updated);
    assert.deepEqual(store.credentials(name("alice"))?.account, updated);
    assert.deepEqual([...store], [updated]);
    assert.deepEqual(store.avatar(alice.id), kAvatar);
  });

  test("replaces the previous avatar", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    store.replaceAvatar(alice.id, kAvatar);

    store.replaceAvatar(alice.id, {
      hash: "fedcba9876543210",
      bytes: new Uint8Array([4])
    });

    assert.equal(store.accountById(alice.id)?.avatarHash, "fedcba9876543210");
    assert.deepEqual(store.avatar(alice.id)?.bytes, new Uint8Array([4]));
  });

  test("has no avatar hash for an account without one", () => {
    using store = storeWith("Alice");
    const [alice] = store;

    assert.equal(alice.avatarHash, null);
    assert.equal(store.avatar(alice.id), null);
  });

  test("deletes the avatar with its account", () => {
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    store.replaceAvatar(bob.id, kAvatar);

    store.remove(alice.id, name("bob"));

    assert.equal(store.avatar(bob.id), null);
  });

  test("refuses an unknown account", () => {
    using store = createStore();

    assert.throws(
      () => store.replaceAvatar("nobody", kAvatar),
      AccountChangeRefusedError
    );
  });
});

describe("AccountStore.open", () => {
  test("persists accounts and sessions to a file", async(t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "accounts-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const location = path.join(directory, "state", "accounts.db");
    const token = SessionToken.mint();

    const written = await AccountStore.open(ROLES, location);
    const alice = written.register(name("Alice"), FIXED_HASH);
    written.openSession(token, alice.id, kNever);
    written.close();

    using reopened = await AccountStore.open(ROLES, location);
    assert.deepEqual(reopened.accountById(alice.id), alice);
    assert.equal(reopened.sessionOwner(token), alice.id);
  });
});
