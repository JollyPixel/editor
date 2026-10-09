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
  createAccounts,
  name,
  storeWith
} from "../helpers/accounts.ts";
import { solidPng } from "../helpers/avatar/images.ts";
import {
  AccountsRejectedError,
  AccountsRoster,
  type RosterEntry
} from "#src/index.ts";
import type { Accounts } from "#src/node.ts";
import { PasswordDigest } from "#src/session/PasswordDigest.ts";

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
  accounts: Accounts,
  revocations = true
): RosterServer {
  const peers: Peer[] = [];
  const clients: Client[] = [];
  const rosters: AccountsRoster[] = [];
  const server = new Server({
    auth: {
      authenticate: () => peers.shift() ?? null,
      watchRevocations: revocations ?
        (listener) => accounts.watchRevocations(listener) :
        undefined
    }
  });
  server.register(accounts.extension);
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

describe("AccountsExtension roster", () => {
  test("pushes every account, its role and whether it is online to any member", async() => {
    using store = storeWith("Alice", "Bob");
    const [alice] = store;
    await using server = rosterServer(createAccounts(store));

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
    await using server = rosterServer(createAccounts(store));
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
    const accounts = createAccounts(store);
    await using server = rosterServer(accounts);
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const changed = nextChange(roster);
    await accounts.register(name("Carol"), PasswordDigest.parse("p".repeat(43)));

    assert.deepEqual(summary(await changed), ["Alice:admin:on", "Carol:spectator:off"]);
  });

  test("pushes the path of a new avatar", async() => {
    using store = storeWith("Alice");
    const [alice] = store;
    const accounts = createAccounts(store);
    await using server = rosterServer(accounts);
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    const changed = nextChange(roster);
    const { avatar } = await accounts.replaceAvatar(alice.id, await solidPng(8, 8));

    assert.equal((await changed)[0].avatar, avatar);
  });
});

describe("AccountsExtension commands", () => {
  test("assigns a declared role and removes an account", async() => {
    using store = storeWith("Alice", "Bob", "Carol");
    const [alice] = store;
    await using server = rosterServer(createAccounts(store));
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
    store.assignRole(name("bob"), "admin");
    await using server = rosterServer(createAccounts(store));
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });

    await roster.assignRole("alice", "member");
  });

  test("rejects a command from a peer that is not an admin", async() => {
    using store = storeWith("Alice", "Bob");
    const [, bob] = store;
    await using server = rosterServer(createAccounts(store));
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
    const [alice] = store;
    const accounts = createAccounts(store);
    await using server = rosterServer(accounts, false);
    const roster = await server.connect({
      role: "admin",
      subject: alice.id
    });
    accounts.assignRole(name("bob"), "admin");
    accounts.assignRole(name("alice"), "member");

    await assert.rejects(
      roster.remove("bob"),
      /only an admin manages accounts/
    );
  });
});
