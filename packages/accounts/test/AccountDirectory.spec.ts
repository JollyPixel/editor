// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  PASSWORD,
  WRONG_PASSWORD,
  createDirectory,
  name,
  registration,
  storeWith
} from "./helpers/accounts.ts";
import { solidPng } from "./helpers/avatar/images.ts";
import { InvalidCredentialsError } from "#src/auth/errors/InvalidCredentialsError.ts";
import { AccountChangeRefusedError } from "#src/node.ts";
import { InvalidAvatarError } from "#src/index.ts";

describe("AccountDirectory sign-in", () => {
  test("logs in under any casing with the password the account registered with", async() => {
    const directory = createDirectory();

    const registered = await directory.register(registration("Alice"), ADDRESS);
    const logged = await directory.login({
      username: name("alice"),
      password: PASSWORD
    }, ADDRESS);

    assert.deepEqual(logged, registered);
    assert.deepEqual(directory.account(registered.id), registered);
  });

  test("refuses a wrong password and an unknown username alike", async() => {
    const directory = createDirectory();
    await directory.register(registration("Alice"), ADDRESS);

    await assert.rejects(
      directory.login({
        username: name("Alice"),
        password: WRONG_PASSWORD
      }, ADDRESS),
      InvalidCredentialsError
    );
    await assert.rejects(
      directory.login({
        username: name("Nobody"),
        password: PASSWORD
      }, ADDRESS),
      InvalidCredentialsError
    );
  });
});

describe("AccountDirectory changes", () => {
  test("emits changed after a registration, a role change and a removal", async() => {
    using store = storeWith("Alice");
    const [alice] = store;
    const directory = createDirectory(store);
    let changes = 0;
    directory.on("changed", () => {
      changes++;
    });

    await directory.register(registration("Bob"), ADDRESS);
    directory.assignRole(alice.id, name("bob"), "member");
    directory.remove(alice.id, name("bob"));

    assert.equal(changes, 3);
  });

  test("emits nothing for a refused role change", () => {
    using store = storeWith("Alice", "Bob");
    const [alice] = store;
    const directory = createDirectory(store);
    let changes = 0;
    directory.on("changed", () => {
      changes++;
    });

    assert.throws(
      () => directory.assignRole(alice.id, name("bob"), "editor"),
      AccountChangeRefusedError
    );
    assert.equal(changes, 0);
  });

  test("revokes the account on a role change and a removal", () => {
    using store = storeWith("Alice", "Bob", "Carol");
    const [alice, bob, carol] = store;
    const directory = createDirectory(store);
    const revoked: string[] = [];
    const stop = directory.watchRevocations((accountId) => revoked.push(accountId));

    directory.assignRole(alice.id, name("bob"), "member");
    directory.remove(alice.id, name("bob"));
    stop();
    directory.remove(alice.id, name("carol"));

    assert.deepEqual(revoked, [bob.id, bob.id]);
    assert.equal(directory.account(carol.id), null);
  });
});

describe("AccountDirectory.replaceAvatar", () => {
  test("encodes the image, stores it and emits changed", async() => {
    using store = storeWith("Alice");
    const [alice] = store;
    const directory = createDirectory(store);
    let changes = 0;
    directory.on("changed", () => {
      changes++;
    });

    const account = await directory.replaceAvatar(alice.id, await solidPng(8, 8));

    assert.equal(changes, 1);
    assert.equal(
      account.avatar,
      `/api/accounts/${alice.id}/avatar?v=${directory.avatar(alice.id)?.hash}`
    );
    assert.deepEqual([...directory], [account]);
  });

  test("refuses an undecodable image without emitting", async() => {
    using store = storeWith("Alice");
    const [alice] = store;
    const directory = createDirectory(store);
    let changes = 0;
    directory.on("changed", () => {
      changes++;
    });

    await assert.rejects(
      directory.replaceAvatar(alice.id, new Uint8Array([1, 2, 3])),
      InvalidAvatarError
    );
    assert.equal(changes, 0);
    assert.equal(directory.avatar(alice.id), null);
  });
});
