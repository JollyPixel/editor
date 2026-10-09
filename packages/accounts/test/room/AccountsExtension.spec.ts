// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADDRESS,
  createDirectory,
  databaseWith,
  name,
  registration,
  requestAccess
} from "../helpers/accounts.ts";
import { solidPng } from "../helpers/avatar/images.ts";
import {
  nextChange,
  rosterServer
} from "../helpers/room/rosterServer.ts";
import {
  AccountsRejectedError,
  type AccountsRoster,
  type RosterEntry
} from "#src/index.ts";

function summary(
  entries: Iterable<RosterEntry>
): string[] {
  return Array.from(
    entries,
    ({ username, role, online }) => `${username}:${role}:${online ? "on" : "off"}`
  );
}

function requests(
  roster: AccountsRoster
): string[] {
  return roster.requests.map((request) => request.username);
}

describe("AccountsExtension roster", () => {
  test("pushes every account, its role and whether it is online to any member", async() => {
    using database = databaseWith("Alice", "Bob");
    const [alice] = database.accounts;
    await using server = rosterServer(createDirectory(database));

    const roster = await server.connect({
      role: "spectator",
      subject: alice.id
    });

    assert.deepEqual(roster.roles, ["admin", "member", "spectator"]);
    assert.deepEqual(summary(roster), ["Alice:admin:on", "Bob:spectator:off"]);
  });

  test("follows peers joining and leaving", async() => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    await using server = rosterServer(createDirectory(database));
    const aliceRoster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const joined = nextChange(aliceRoster);
    const bobRoster = await server.connect({
      role: "spectator",
      subject: bob.id
    });
    assert.deepEqual(summary(await joined), ["Alice:admin:on", "Bob:spectator:on"]);

    const left = nextChange(aliceRoster);
    bobRoster.dispose();
    assert.deepEqual(summary(await left), ["Alice:admin:on", "Bob:spectator:off"]);
  });

  test("pushes a registration made outside the room", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const directory = createDirectory(database);
    await using server = rosterServer(directory);
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const changed = nextChange(roster);
    await directory.register(registration("Carol"), ADDRESS);

    assert.deepEqual(summary(await changed), ["Alice:admin:on", "Carol:spectator:off"]);
  });

  test("pushes the path of a new avatar", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    const directory = createDirectory(database);
    await using server = rosterServer(directory);
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const changed = nextChange(roster);
    const { avatar } = await directory.replaceAvatar(alice.id, await solidPng(8, 8));

    assert.equal((await changed)[0].avatar, avatar);
  });

  test("pushes access requests to admins only", async() => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    requestAccess(database, "Carol");
    await using server = rosterServer(createDirectory(database));

    const adminRoster = await server.connect({
      role: "admin",
      subject: alice.id
    });
    const spectatorRoster = await server.connect({
      role: "spectator",
      subject: bob.id
    });

    assert.deepEqual(requests(adminRoster), ["Carol"]);
    assert.deepEqual(requests(spectatorRoster), []);
    assert.deepEqual(summary(spectatorRoster), ["Alice:admin:on", "Bob:spectator:on"]);
  });
});

describe("AccountsExtension commands", () => {
  test("approves one access request with a role and denies another", async() => {
    using database = databaseWith("Alice");
    const [alice] = database.accounts;
    requestAccess(database, "Bob");
    requestAccess(database, "Carol");
    await using server = rosterServer(createDirectory(database));
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const approved = nextChange(roster);
    await roster.approve("bob", "member");
    await approved;
    const denied = nextChange(roster);
    await roster.deny("carol");
    await denied;

    assert.deepEqual(requests(roster), []);
    assert.deepEqual(summary(roster), ["Alice:admin:on", "Bob:member:off"]);
  });

  test("assigns a declared role and removes an account", async() => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice] = database.accounts;
    await using server = rosterServer(createDirectory(database));
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const assigned = nextChange(roster);
    await roster.assignRole("bob", "member");
    assert.deepEqual(
      summary(await assigned),
      ["Alice:admin:on", "Bob:member:off", "Carol:spectator:off"]
    );

    const removed = nextChange(roster);
    await roster.remove("carol");
    assert.deepEqual(summary(await removed), ["Alice:admin:on", "Bob:member:off"]);
  });

  test("answers an admin who demotes itself before revoking its connection", {
    timeout: 2_000
  }, async() => {
    using database = databaseWith("Alice", "Bob");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);
    directory.assignRole(alice.id, name("bob"), "admin");
    await using server = rosterServer(directory);
    const roster = await server.connect({
      role: "admin",
      subject: bob.id
    });

    await roster.assignRole("bob", "member");
  });

  test("transfers ownership from the owner to another account", async() => {
    using database = databaseWith("Alice", "Bob");
    const [alice] = database.accounts;
    await using server = rosterServer(createDirectory(database));
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const transferred = nextChange(roster);
    await roster.transferOwnership("bob");

    assert.deepEqual(
      (await transferred).map(({ username, role, owner }) => `${username}:${role}:${owner}`),
      ["Alice:admin:false", "Bob:admin:true"]
    );
  });

  test("rejects a command from a peer that is not an admin", async() => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    await using server = rosterServer(createDirectory(database));
    const roster = await server.connect({
      role: "member",
      subject: bob.id
    });

    await assert.rejects(
      roster.remove("bob"),
      (error) => error instanceof AccountsRejectedError &&
        /only an admin manages accounts/.test(error.message)
    );
    assert.equal(database.accounts.size, 2);
  });
});

describe("AccountsExtension authorization", () => {
  test("reads the current role of a sender whose connection is not revoked", async() => {
    using database = databaseWith("Alice", "Bob", "Carol");
    const [alice, bob] = database.accounts;
    const directory = createDirectory(database);
    directory.assignRole(alice.id, name("bob"), "admin");
    await using server = rosterServer(directory, false);
    const roster = await server.connect({
      role: "admin",
      subject: bob.id
    });
    directory.assignRole(alice.id, name("bob"), "member");

    await assert.rejects(
      roster.remove("carol"),
      /only an admin manages accounts/
    );
  });
});
