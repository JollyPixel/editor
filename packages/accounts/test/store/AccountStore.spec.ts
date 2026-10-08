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
  createStore,
  name,
  storeWith
} from "../helpers/accounts.ts";
import {
  AccountChangeRefusedError,
  AccountStore,
  UsernameTakenError
} from "#src/node.ts";

describe("AccountStore.register", () => {
  test("makes the first account an admin and later ones the default role", () => {
    using store = createStore();

    const first = store.register(name("Alice"), FIXED_HASH, "spectator");
    const second = store.register(name("bob"), FIXED_HASH, "spectator");

    assert.equal(first.role, "admin");
    assert.equal(second.role, "spectator");
    assert.deepEqual([...store], [first, second]);
  });

  test("refuses a username that differs only by case", () => {
    using store = storeWith("Alice");

    assert.throws(
      () => store.register(name("aLICE"), FIXED_HASH, "spectator"),
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

describe("AccountStore sessions", () => {
  test("resolves an open session to its account until it is closed", () => {
    using store = storeWith("Alice");
    const [alice] = store;

    const token = store.openSession(alice.id);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(store.accountForToken(token), alice);

    store.closeSession(token);
    assert.equal(store.accountForToken(token), null);
  });

  test("expires a session after its time to live", (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    using store = createStore({ sessionTtlMs: 1_000 });
    const alice = store.register(name("Alice"), FIXED_HASH, "spectator");
    const token = store.openSession(alice.id);

    t.mock.timers.tick(999);
    assert.deepEqual(store.accountForToken(token), alice);

    t.mock.timers.tick(1);
    assert.equal(store.accountForToken(token), null);
  });

  test("rejects a token it never minted while another session is open", () => {
    using store = storeWith("Alice");
    const [alice] = store;
    store.openSession(alice.id);

    assert.equal(store.accountForToken("x".repeat(43)), null);
  });
});

describe("AccountStore.assignRole", () => {
  test("changes the role of an account", () => {
    using store = storeWith("Alice", "Bob");

    const bob = store.assignRole(name("bob"), "member");

    assert.equal(bob.role, "member");
    assert.deepEqual(
      [...store].map((account) => account.role),
      ["admin", "member"]
    );
  });

  test("refuses to demote the last admin", () => {
    using store = storeWith("Alice", "Bob");

    assert.throws(
      () => store.assignRole(name("alice"), "member"),
      AccountChangeRefusedError
    );

    store.assignRole(name("bob"), "admin");
    assert.equal(store.assignRole(name("alice"), "member").role, "member");
  });

  test("refuses an unknown account", () => {
    using store = storeWith("Alice");

    assert.throws(
      () => store.assignRole(name("carol"), "member"),
      AccountChangeRefusedError
    );
  });
});

describe("AccountStore.remove", () => {
  test("deletes the account and closes its sessions", () => {
    using store = storeWith("Alice", "Bob");
    const [, bob] = store;
    const token = store.openSession(bob.id);

    store.remove(name("BOB"));

    assert.equal(store.accountForToken(token), null);
    assert.equal(store.credentials(name("bob")), null);
    assert.equal(store.size, 1);
  });

  test("refuses to remove the last admin", () => {
    using store = storeWith("Alice");

    assert.throws(
      () => store.remove(name("alice")),
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
    const token = store.openSession(alice.id);

    const updated = store.replaceAvatar(alice.id, kAvatar);

    assert.equal(updated.avatarHash, kAvatar.hash);
    assert.deepEqual(store.accountById(alice.id), updated);
    assert.deepEqual(store.accountForToken(token), updated);
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
    const [, bob] = store;
    store.replaceAvatar(bob.id, kAvatar);

    store.remove(name("bob"));

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

    const written = await AccountStore.open(location);
    const alice = written.register(name("Alice"), FIXED_HASH, "spectator");
    const token = written.openSession(alice.id);
    written.close();

    using reopened = await AccountStore.open(location);
    assert.deepEqual(reopened.accountForToken(token), alice);
  });
});
