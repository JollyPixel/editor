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
  PASSWORD,
  REALM,
  WRONG_PASSWORD,
  addMembership,
  createDirectory,
  databaseWith,
  insertAccount,
  insertAgentToken,
  name
} from "./helpers/accounts.ts";
import { solidPng } from "./helpers/avatar/images.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { InvalidCredentialsError } from "#src/auth/errors/InvalidCredentialsError.ts";
import { Membership } from "#src/realm/Membership.ts";
import {
  AccountChangeRefusedError,
  UsernameTakenError
} from "#src/node.ts";
import {
  InvalidAvatarError,
  type Account
} from "#src/index.ts";

async function insert(
  directory: AccountDirectory,
  username: string
): Promise<AccountEntity> {
  return directory.insert(name(username), await directory.hash(PASSWORD));
}

describe("AccountDirectory.insert", () => {
  test("makes the first account the owner and refuses a username that differs only by case", async() => {
    const directory = createDirectory();

    const alice = await insert(directory, "Alice");
    const bob = await insert(directory, "Bob");

    assert.equal(alice.owner, true);
    assert.equal(bob.owner, false);
    await assert.rejects(insert(directory, "aLICE"), UsernameTakenError);
    assert.equal(directory.database.accounts.size, 2);
  });
});

describe("AccountDirectory.login", () => {
  test("logs in under any casing with the password the account registered with", async() => {
    const directory = createDirectory();
    const alice = await insert(directory, "Alice");

    const logged = await directory.login({
      username: name("alice"),
      password: PASSWORD
    }, ADDRESS);

    assert.deepEqual(logged, alice);
    assert.deepEqual(directory.account(alice.id), {
      id: alice.id,
      username: "Alice",
      owner: true,
      avatar: undefined
    });
  });

  test("refuses a wrong password and an unknown username alike", async() => {
    const directory = createDirectory();
    await insert(directory, "Alice");

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

describe("AccountDirectory.transferOwnership", () => {
  test("hands ownership over and keeps the previous owner admin of every known and open realm", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const carol = insertAccount(database, AccountEntity.register(name("Carol")));
    addMembership(database, Membership.active("third", carol.id, "member"));
    const directory = createDirectory(database);
    directory.openRealm(OTHER_REALM);

    const owner = directory.transferOwnership(alice.id, name("bob"));

    assert.equal(owner.id, bob.id);
    assert.equal(directory.account(bob.id)?.owner, true);
    assert.equal(directory.account(alice.id)?.owner, false);
    for (const realmId of [REALM, OTHER_REALM, "third"]) {
      assert.deepEqual(
        database.memberships.find(realmId, alice.id),
        Membership.active(realmId, alice.id, "admin")
      );
    }
  });

  test("revokes the new owner and its agents in every realm", () => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const agents = [
      insertAgentToken(database, bob.id),
      insertAgentToken(database, bob.id, OTHER_REALM)
    ];
    const directory = createDirectory(database);
    const revoked: string[] = [];
    directory.subscribe("revoked", (subject) => revoked.push(subject));

    directory.transferOwnership(alice.id, name("bob"));

    assert.deepEqual(revoked, [
      bob.id,
      ...agents.map((agent) => `agent:${agent.id}`)
    ]);
  });

  test("refuses an actor that is not the owner, and the owner as target", () => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);

    assert.throws(
      () => directory.transferOwnership(bob.id, name("carol")),
      {
        name: "AccountChangeRefusedError",
        message: "only the owner transfers ownership"
      }
    );
    assert.throws(
      () => directory.transferOwnership(alice.id, name("alice")),
      AccountChangeRefusedError
    );
    assert.equal(directory.account(alice.id)?.owner, true);
  });
});

describe("AccountDirectory.openRealm", () => {
  test("refuses a realm that is already open until it closes", () => {
    const directory = createDirectory();

    directory.openRealm(REALM);

    assert.throws(() => directory.openRealm(REALM), Error);
    directory.closeRealm(REALM);
    directory.openRealm(REALM);
  });
});

describe("AccountDirectory.replaceAvatar", () => {
  test("encodes the image, stores it and emits changed and the new profile", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const directory = createDirectory(database);
    const profiles: Account[] = [];
    let changes = 0;
    directory.on("changed", () => {
      changes++;
    });
    directory.on("profile", (account) => profiles.push(account));

    const account = await directory.replaceAvatar(alice.id, await solidPng(8, 8));

    assert.equal(changes, 1);
    assert.equal(
      account.avatar,
      `/api/accounts/${alice.id}/avatar?v=${directory.avatar(alice.id)?.hash}`
    );
    assert.deepEqual(profiles, [account]);
    assert.deepEqual(directory.account(alice.id), account);
  });

  test("refuses an undecodable image without emitting", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const directory = createDirectory(database);
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

  test("refuses an unknown account", async() => {
    const directory = createDirectory();

    await assert.rejects(
      directory.replaceAvatar("nobody", await solidPng(8, 8)),
      AccountChangeRefusedError
    );
  });
});
