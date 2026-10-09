// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Client,
  LoopbackTransport,
  Server
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  ADDRESS,
  FIXED_HASH,
  createDirectory,
  name,
  registration,
  storeWith
} from "../helpers/accounts.ts";
import { solidPng } from "../helpers/avatar/images.ts";
import {
  AccountsRejectedError,
  AccountsRoster,
  type RosterEntry
} from "#src/index.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";
import { AccountsExtension } from "#src/room/AccountsExtension.ts";

interface Peer {
  role: string;
  subject: string;
}

interface RosterServer extends AsyncDisposable {
  connect(
    peer: Peer
  ): Promise<AccountsRoster>;
}

function rosterServer(
  directory: AccountDirectory,
  revocations = true
): RosterServer {
  const peers: Peer[] = [];
  const clients: Client[] = [];
  const rosters: AccountsRoster[] = [];
  const server = new Server({
    auth: {
      authenticate: () => peers.shift() ?? null,
      watchRevocations: revocations ?
        (listener) => directory.watchRevocations(listener) :
        undefined
    }
  });
  server.register(new AccountsExtension(directory));
  const loopback = new LoopbackTransport({ server });

  return {
    async connect(peer) {
      peers.push(peer);
      const client = new Client({
        socket: () => loopback.connect(),
        reconnect: false
      });
      const roster = AccountsRoster.join(client);
      clients.push(client);
      rosters.push(roster);
      await roster.ready;

      return roster;
    },
    async [Symbol.asyncDispose]() {
      for (const roster of rosters) {
        roster.dispose();
      }
      for (const client of clients) {
        client.destroy();
      }
      await server.close();
    }
  };
}

function nextChange(
  roster: AccountsRoster
): Promise<RosterEntry[]> {
  const { promise, resolve } = Promise.withResolvers<RosterEntry[]>();
  roster.once("change", () => resolve([...roster]));

  return promise;
}

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
    using store = storeWith("Alice", "Bob");
    const [alice] = store;
    await using server = rosterServer(createDirectory(store));

    const roster = await server.connect({
      role: "spectator",
      subject: alice.id
    });

    assert.deepEqual(roster.roles, ["admin", "member", "spectator"]);
    assert.deepEqual(summary(roster), ["Alice:admin:on", "Bob:spectator:off"]);
  });

  test("follows peers joining and leaving", async() => {
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    await using server = rosterServer(createDirectory(store));
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
    using store = storeWith("Alice");
    const [alice] = store;
    const directory = createDirectory(store);
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
    using store = storeWith("Alice");
    const [alice] = store;
    const directory = createDirectory(store);
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
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    store.requestAccess(name("Carol"), FIXED_HASH, 5);
    await using server = rosterServer(createDirectory(store));

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
    using store = storeWith("Alice");
    const [alice] = store;
    store.requestAccess(name("Bob"), FIXED_HASH, 5);
    store.requestAccess(name("Carol"), FIXED_HASH, 5);
    await using server = rosterServer(createDirectory(store));
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
    using store = storeWith("Alice", "Bob", "Carol");
    const [alice] = store;
    await using server = rosterServer(createDirectory(store));
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
    using store = storeWith("Alice", "Bob");
    const [alice] = store;
    store.assignRole(alice.id, name("bob"), "admin");
    await using server = rosterServer(createDirectory(store));
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    await roster.assignRole("alice", "member");
  });

  test("rejects a command from a peer that is not an admin", async() => {
    using store = storeWith("Alice", "Bob");
    const [, bob] = store;
    await using server = rosterServer(createDirectory(store));
    const roster = await server.connect({
      role: "member",
      subject: bob.id
    });

    await assert.rejects(
      roster.remove("bob"),
      (error) => error instanceof AccountsRejectedError &&
        /only an admin manages accounts/.test(error.message)
    );
    assert.equal(store.size, 2);
  });
});

describe("AccountsExtension authorization", () => {
  test("reads the current role of a sender whose connection is not revoked", async() => {
    using store = storeWith("Alice", "Bob");
    const [alice, bob] = store;
    const directory = createDirectory(store);
    await using server = rosterServer(directory, false);
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });
    directory.assignRole(alice.id, name("bob"), "admin");
    directory.assignRole(bob.id, name("alice"), "member");

    await assert.rejects(
      roster.remove("bob"),
      /only an admin manages accounts/
    );
  });
});
