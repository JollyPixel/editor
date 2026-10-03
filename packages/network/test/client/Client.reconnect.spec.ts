// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Client,
  UNAUTHORIZED_CLOSE_CODE
} from "#src/index.ts";
import { captureLogger } from "../helpers/captureLogger.ts";
import {
  createReconnectingClient,
  FakeSocket
} from "../helpers/client/FakeSocket.ts";

// CONSTANTS
const kDropped = {
  code: 1006,
  reason: "gone"
};

function sentOf(
  socket: FakeSocket
): unknown[] {
  return socket.sent.map((raw) => JSON.parse(raw));
}

function admit(
  socket: FakeSocket,
  self: string,
  peers: string[] = []
): void {
  socket.receive({
    room: "pixel-draw",
    kind: "sync",
    self,
    rights: {},
    members: [self, ...peers].map((clientId) => {
      return {
        clientId,
        role: "default",
        profile: {},
        presence: {}
      };
    })
  });
}

describe("Client — reconnect", () => {
  test("reopens the socket after each delay, the last one repeating", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { logger } = captureLogger();
    const { sockets } = createReconnectingClient({
      logger,
      reconnect: { delays: [100, 300] }
    });
    sockets[0].open();

    sockets[0].serverClose(kDropped);
    t.mock.timers.tick(99);
    assert.strictEqual(sockets.length, 1);
    t.mock.timers.tick(1);
    assert.strictEqual(sockets.length, 2);

    sockets[1].serverClose(kDropped);
    t.mock.timers.tick(300);
    sockets[2].serverClose(kDropped);
    t.mock.timers.tick(300);

    assert.strictEqual(sockets.length, 4);
  });

  test("rejoins joined rooms with their resume payload before flushing queued envelopes", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { logger } = captureLogger();
    const { client, sockets } = createReconnectingClient({ logger });
    sockets[0].open();
    const room = client.room("pixel-draw");
    room.resumeWith(() => {
      return { clientId: "A", version: 3 };
    });
    room.join();

    sockets[0].serverClose(kDropped);
    room.updatePresence({ cursor: 1 });
    t.mock.timers.tick(500);
    sockets[1].open();

    assert.deepEqual(sentOf(sockets[1]), [
      {
        room: "pixel-draw",
        kind: "join",
        profile: {},
        presence: { cursor: 1 },
        resume: { clientId: "A", version: 3 }
      },
      {
        room: "pixel-draw",
        kind: "presence",
        patch: { cursor: 1 }
      }
    ]);
  });

  test("suspends joined rooms until the server admits them again", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { logger } = captureLogger();
    const { client, sockets } = createReconnectingClient({ logger });
    sockets[0].open();
    const room = client.room("pixel-draw");
    room.join();
    admit(sockets[0], "A", ["B"]);
    const events: string[] = [];
    room.on("peer-left", ({ clientId }) => events.push(`left:${clientId}`));
    client.on("disconnected", () => events.push("disconnected"));

    sockets[0].serverClose(kDropped);

    assert.strictEqual(room.clientId, null);
    assert.strictEqual(room.peers.size, 0);
    assert.deepEqual(events, ["left:B", "disconnected"]);

    t.mock.timers.tick(500);
    sockets[1].open();
    admit(sockets[1], "C", ["B"]);

    assert.strictEqual(room.clientId, "C");
    assert.deepEqual([...room.peers.keys()], ["B"]);
  });

  test("retries a socket that never opened, sending its queued join once", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { client, sockets } = createReconnectingClient();
    let disconnected = 0;
    client.on("disconnected", () => disconnected++);
    client.room("pixel-draw").join();

    sockets[0].serverClose(kDropped);
    t.mock.timers.tick(500);
    sockets[1].open();

    assert.strictEqual(disconnected, 0);
    assert.strictEqual(client.ready, true);
    assert.deepEqual(sentOf(sockets[1]), [
      { room: "pixel-draw", kind: "join", profile: {}, presence: {} }
    ]);
  });

  test("keeps retrying when the socket factory throws", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { logger, errors } = captureLogger();
    let calls = 0;
    const sockets: FakeSocket[] = [];
    const client = new Client({
      logger,
      socket: () => {
        calls++;
        if (calls === 2) {
          throw new Error("offline");
        }
        const socket = new FakeSocket();
        sockets.push(socket);

        return socket;
      }
    });
    sockets[0].open();

    sockets[0].serverClose(kDropped);
    t.mock.timers.tick(500);
    t.mock.timers.tick(1_000);
    sockets[1].open();

    assert.strictEqual(calls, 3);
    assert.strictEqual(client.ready, true);
    assert.match(errors[0], /failed to reopen the connection/);
  });

  test("an unauthorized close stops reconnecting", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { client, sockets } = createReconnectingClient();
    sockets[0].open();
    let unauthorized = 0;
    client.on("unauthorized", () => unauthorized++);

    sockets[0].serverClose({ code: UNAUTHORIZED_CLOSE_CODE, reason: "unauthorized" });
    t.mock.timers.tick(10_000);

    assert.strictEqual(unauthorized, 1);
    assert.strictEqual(sockets.length, 1);
  });

  test("destroy during the gap cancels the next attempt", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { logger } = captureLogger();
    const { client, sockets } = createReconnectingClient({ logger });
    sockets[0].open();

    sockets[0].serverClose(kDropped);
    client.destroy();
    t.mock.timers.tick(10_000);

    assert.strictEqual(sockets.length, 1);
    assert.strictEqual(client.ready, false);
  });

  test("ignores a replaced socket's late events", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { logger } = captureLogger();
    const { client, sockets } = createReconnectingClient({ logger });
    sockets[0].open();
    const room = client.room("pixel-draw");
    room.join();

    sockets[0].serverClose(kDropped);
    t.mock.timers.tick(500);
    sockets[1].open();
    admit(sockets[0], "stale");
    sockets[0].serverClose(kDropped);

    assert.strictEqual(room.clientId, null);
    assert.strictEqual(client.ready, true);
    assert.strictEqual(sockets.length, 2);
  });
});
