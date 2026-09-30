// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  CommandSync,
  type NetworkCommandHeader,
  type NetworkServerMessage
} from "#src/index.ts";
import { captureLogger } from "../helpers/captureLogger.ts";
import {
  createReconnectingClient,
  type FakeSocket
} from "../helpers/FakeSocket.ts";

type TestCommand = { action: "set"; value: number; } & NetworkCommandHeader;

type TestMessage = NetworkServerMessage<TestCommand, { value: number; }>;

// CONSTANTS
const kRoom = "counter";

function admit(
  socket: FakeSocket,
  self: string
): void {
  socket.receive({
    room: kRoom,
    kind: "sync",
    self,
    rights: {},
    members: [{ clientId: self, role: "default", profile: {}, presence: {} }]
  });
}

function deliver(
  socket: FakeSocket,
  payload: TestMessage
): void {
  socket.receive({
    room: kRoom,
    kind: "message",
    payload
  });
}

function sentBy(
  socket: FakeSocket
): unknown[] {
  return socket.sent.map((raw) => JSON.parse(raw));
}

function commandsSentBy(
  socket: FakeSocket
): string[] {
  return sentBy(socket).flatMap((envelope) => {
    const { kind, payload } = envelope as { kind: string; payload?: TestCommand; };

    return kind === "message" ?
      [`${payload!.clientId}:${payload!.seq}:${payload!.value}`] :
      [];
  });
}

function setup(
  t: TestContext
) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { logger } = captureLogger();
  const { client, sockets } = createReconnectingClient({ logger });
  const room = client.room<TestCommand, TestMessage>(kRoom);
  const sync = new CommandSync<TestCommand, { value: number; }>(room);
  sockets[0].open();
  room.join();
  admit(sockets[0], "A");
  deliver(sockets[0], { type: "snapshot", data: { value: 0 }, version: 0 });

  return {
    sockets,
    sync,
    reconnect(): FakeSocket {
      sockets[0].serverClose({ code: 1006, reason: "gone" });
      t.mock.timers.tick(500);
      const socket = sockets.at(-1)!;
      socket.open();

      return socket;
    }
  };
}

describe("CommandSync over a reconnecting Client", () => {
  test("a command that landed before the drop is not sent twice; a lost one is sent once", (t) => {
    const { sockets, sync, reconnect } = setup(t);

    sync.send({ action: "set", value: 1 }, 0);
    sync.send({ action: "set", value: 2 }, 0);
    const socket = reconnect();
    sync.send({ action: "set", value: 3 }, 0);

    assert.deepEqual(sentBy(socket)[0], {
      room: kRoom,
      kind: "join",
      profile: {},
      presence: {},
      resume: { clientId: "A", version: 0 }
    });
    admit(socket, "B");
    deliver(socket, {
      type: "catch-up",
      data: [{ action: "set", value: 1, clientId: "A", seq: 1, timestamp: 0 }],
      version: 1,
      acks: { A: 1 }
    });

    assert.deepEqual(commandsSentBy(sockets[0]), ["A:1:1", "A:2:2"]);
    assert.deepEqual(commandsSentBy(socket), ["B:3:2", "B:4:3"]);
  });

  test("a gap the server answers with a snapshot resends the unacknowledged commands", (t) => {
    const { sync, reconnect } = setup(t);
    const snapshots: number[] = [];
    sync.on("snapshot", (snapshot) => snapshots.push(snapshot.value));

    sync.send({ action: "set", value: 1 }, 0);
    const socket = reconnect();
    admit(socket, "B");
    deliver(socket, { type: "snapshot", data: { value: 40 }, version: 900 });

    assert.deepEqual(snapshots, [40]);
    assert.deepEqual(commandsSentBy(socket), ["B:2:1"]);
    assert.strictEqual(sync.version, 900);
  });
});
