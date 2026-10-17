// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { WorkerExtensionProxy } from "#src/node.ts";
import { createLogger } from "#src/server/logger.ts";
import { OPAQUE_PROTOCOLS } from "../../../helpers/protocol/protocols.ts";
import type {
  ClientHandle,
  RoomBroadcast,
  RoomContext
} from "#src/index.ts";

const fixtureUrl = new URL("../../../fixtures/workerExtension.fixture.ts", import.meta.url);

function createSharedRoom(): { room: RoomBroadcast; sent: unknown[]; } {
  const sent: unknown[] = [];
  const room: RoomBroadcast = {
    broadcast: (payload) => sent.push(payload),
    sendTo: (_clientId, payload) => sent.push(payload)
  };

  return { room, sent };
}

function createContext(
  room: RoomBroadcast
): RoomContext {
  return {
    room,
    identity: {
      subject: "alice-subject",
      role: "editor"
    }
  };
}

describe("WorkerExtensionProxy — real worker_threads.Worker (e2e)", () => {
  test(
    "runs a real Extension inside a worker: connect, message, identity round-trip, disconnect",
    async() => {
      const proxy = new WorkerExtensionProxy(
        {
          id: "fixture",
          name: "fixture",
          protocols: OPAQUE_PROTOCOLS,
          modulePath: fixtureUrl,
          workerData: { greeting: "hi" }
        },
        { logger: createLogger() }
      );

      try {
        const { room, sent } = createSharedRoom();

        const client: ClientHandle = { id: "A", send: () => void 0 };

        await proxy.onClientConnect(client, {
          clientId: "A",
          identity: { subject: "A", role: "default" },
          profile: { username: "alice" },
          presence: {}
        }, createContext(room));
        assert.deepEqual(sent, [{
          type: "welcome",
          greeting: "hi",
          username: "alice",
          subject: "alice-subject"
        }]);
        sent.length = 0;

        await proxy.onMessage("A", { compute: true }, createContext(room));
        assert.equal(sent.length, 1);
        assert.partialDeepStrictEqual(sent[0], { type: "result" });
        sent.length = 0;

        await proxy.onMessage("A", { hello: "world" }, createContext(room));
        assert.deepEqual(sent, [{ type: "echo", role: "editor" }]);
        sent.length = 0;

        await proxy.onClientDisconnect("A", createContext(room));
        assert.deepEqual(sent, [{ type: "bye" }]);
      }
      finally {
        await proxy.close();
      }
    }
  );
});
