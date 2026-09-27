// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../helpers/identity.ts";
import { createClient } from "../helpers/clientHandle.ts";
import { EnvelopeDispatcher } from "#src/server/EnvelopeDispatcher.ts";
import { ClientSessions } from "#src/server/ClientSessions.ts";
import { RoomRegistry } from "#src/server/room/RoomRegistry.ts";
import { createLogger } from "#src/server/logger.ts";
import {
  PresenceOnlyExtension,
  RightsTable,
  type ClientEnvelope
} from "#src/index.ts";
import { actionProtocols } from "../helpers/protocols.ts";

interface Harness {
  dispatcher: EnvelopeDispatcher;
  sessions: ClientSessions;
  rooms: RoomRegistry;
}

function createHarness(
  rights?: RightsTable
): Harness {
  const sessions = new ClientSessions();
  const rooms = new RoomRegistry({
    logger: createLogger(),
    rights: rights ?? new RightsTable()
  });
  rooms.register(new PresenceOnlyExtension("lobby", "lobby", {
    broadcast: true,
    protocols: actionProtocols
  }));

  return {
    dispatcher: new EnvelopeDispatcher({ rooms, sessions }),
    sessions,
    rooms
  };
}

function joinedRooms(
  sessions: ClientSessions,
  clientId: string
): string[] {
  const session = sessions.get(clientId);
  assert.ok(session);

  return [...session.rooms];
}

describe("EnvelopeDispatcher — routing", () => {
  test("drops an envelope from a client with no open session", async() => {
    const { dispatcher } = createHarness();

    assert.deepEqual(
      await dispatcher.dispatch("ghost", { room: "lobby", kind: "join" }),
      {
        outcome: "dropped",
        reason: "unknown client"
      }
    );
  });

  test("drops an envelope addressed to an unregistered room", async() => {
    const { dispatcher, sessions } = createHarness();
    const { client } = createClient("A");
    sessions.open(client, identityOf(client));

    assert.deepEqual(
      await dispatcher.dispatch("A", { room: "unknown", kind: "join" }),
      {
        outcome: "dropped",
        reason: "unregistered room"
      }
    );
  });
});

describe("EnvelopeDispatcher — join", () => {
  test("admits a client and records the room on its session", async() => {
    const { dispatcher, sessions } = createHarness();
    const { client } = createClient("A");
    sessions.open(client, identityOf(client));

    assert.deepEqual(
      await dispatcher.dispatch("A", { room: "lobby", kind: "join" }),
      { outcome: "joined" }
    );
    assert.deepEqual(joinedRooms(sessions, "A"), ["lobby"]);
  });

  test("ignores a second join for a room already joined", async() => {
    const { dispatcher, sessions } = createHarness();
    const { client } = createClient("A");
    sessions.open(client, identityOf(client));

    await dispatcher.dispatch("A", { room: "lobby", kind: "join" });

    assert.deepEqual(
      await dispatcher.dispatch("A", { room: "lobby", kind: "join" }),
      {
        outcome: "ignored",
        reason: "already joined"
      }
    );
  });

  test("drops a join the room denies and leaves the session untouched", async() => {
    const { dispatcher, sessions } = createHarness(
      new RightsTable({ viewer: { "lobby.$join": "void" } })
    );
    const { client } = createClient("A");
    sessions.open(client, identityOf(client));

    assert.deepEqual(
      await dispatcher.dispatch("A", {
        room: "lobby",
        kind: "join",
        profile: {}
      }),
      {
        outcome: "dropped",
        reason: "join denied"
      }
    );
    assert.deepEqual(joinedRooms(sessions, "A"), []);
  });
});

describe("EnvelopeDispatcher — membership gate", () => {
  const envelopes: ClientEnvelope[] = [
    {
      room: "lobby",
      kind: "message",
      payload: {}
    },
    {
      room: "lobby",
      kind: "presence",
      patch: {}
    }
  ];

  for (const envelope of envelopes) {
    test(`drops a "${envelope.kind}" from a client that never joined`, async() => {
      const { dispatcher, sessions } = createHarness();
      const { client } = createClient("A");
      sessions.open(client, identityOf(client));

      assert.deepEqual(
        await dispatcher.dispatch("A", envelope),
        {
          outcome: "dropped",
          reason: "client has not joined room"
        }
      );
    });
  }

  test("handles a message once the client has joined", async() => {
    const { dispatcher, sessions } = createHarness();
    const a = createClient("A");
    const b = createClient("B");
    sessions.open(a.client, identityOf(a.client));
    sessions.open(b.client, identityOf(b.client));

    await dispatcher.dispatch("A", { room: "lobby", kind: "join" });
    await dispatcher.dispatch("B", { room: "lobby", kind: "join" });
    b.sent.length = 0;

    assert.deepEqual(
      await dispatcher.dispatch("A", {
        room: "lobby",
        kind: "message",
        payload: { action: "voxel-set" }
      }),
      { outcome: "handled" }
    );
    assert.deepEqual(b.sent, [{
      room: "lobby",
      kind: "message",
      payload: { action: "voxel-set" }
    }]);
  });

  test("handles a presence patch once the client has joined", async() => {
    const { dispatcher, sessions } = createHarness();
    const a = createClient("A");
    const b = createClient("B");
    sessions.open(a.client, identityOf(a.client));
    sessions.open(b.client, identityOf(b.client));

    await dispatcher.dispatch("A", { room: "lobby", kind: "join" });
    await dispatcher.dispatch("B", { room: "lobby", kind: "join" });
    b.sent.length = 0;

    assert.deepEqual(
      await dispatcher.dispatch("A", {
        room: "lobby",
        kind: "presence",
        patch: { cursor: 1 }
      }),
      { outcome: "handled" }
    );
    assert.deepEqual(b.sent, [{
      room: "lobby",
      kind: "peer-presence",
      clientId: "A",
      patch: { cursor: 1 }
    }]);
  });
});

describe("EnvelopeDispatcher — leave", () => {
  test("removes the room from the session", async() => {
    const { dispatcher, sessions } = createHarness();
    const { client } = createClient("A");
    sessions.open(client, identityOf(client));

    await dispatcher.dispatch("A", { room: "lobby", kind: "join" });

    assert.deepEqual(
      await dispatcher.dispatch("A", { room: "lobby", kind: "leave" }),
      { outcome: "left" }
    );
    assert.deepEqual(joinedRooms(sessions, "A"), []);
  });

  test("ignores a leave from a client that never joined", async() => {
    const { dispatcher, sessions } = createHarness();
    const { client } = createClient("A");
    sessions.open(client, identityOf(client));

    assert.deepEqual(
      await dispatcher.dispatch("A", { room: "lobby", kind: "leave" }),
      {
        outcome: "ignored",
        reason: "not a member"
      }
    );
  });
});
