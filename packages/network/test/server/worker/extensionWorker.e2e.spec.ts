// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { WorkerExtensionProxy } from "#src/server/worker/WorkerExtensionProxy.ts";
import { createLogger } from "#src/server/logger.ts";
import type {
  ClientHandle,
  RoomBroadcast,
  RoomContext
} from "#src/index.ts";

const fixtureUrl = new URL("../../fixtures/workerExtension.fixture.ts", import.meta.url);

/**
 * WorkerExtensionProxy captures context.room from the *first* dispatch and reuses
 * it for every later room.broadcast/client.send context-call (mirroring ServerRoom's
 * single stable #roomBroadcast) — so every call in a test must share one `room`,
 * not get a fresh one, or later broadcasts would silently land on a discarded object.
 */
function createSharedRoom(): { room: RoomBroadcast; sent: unknown[]; } {
  const sent: unknown[] = [];
  const room: RoomBroadcast = {
    broadcast: (payload) => sent.push(payload),
    sendTo: (_clientId, payload) => sent.push(payload)
  };

  return { room, sent };
}

function createContext(
  room: RoomBroadcast,
  overrides: Partial<RoomContext["eventStore"]> = {}
): RoomContext {
  return {
    room,
    eventStore: {
      append: overrides.append ?? (() => Promise.resolve(true)),
      list: overrides.list ?? (() => Promise.resolve([]))
    }
  };
}

describe("WorkerExtensionProxy — real worker_threads.Worker (e2e)", () => {
  test("runs a real Extension inside a worker: connect, message, eventStore round-trip, disconnect", async() => {
    const proxy = new WorkerExtensionProxy(
      {
        id: "fixture",
        name: "fixture",
        modulePath: fixtureUrl,
        workerData: { greeting: "hi" }
      },
      { logger: createLogger() }
    );

    try {
      const { room, sent } = createSharedRoom();

      // A worker-hosted extension can't hold onto the literal ClientHandle it was
      // passed (it's synthesized locally in the worker) — its .send() is proxied
      // through the same stable roomBroadcast.sendTo every later out-of-band send
      // uses, exactly like ServerRoom's real #members.get(clientId)?.handle.send.
      const client: ClientHandle = { id: "A", send: () => void 0 };
      const appended: unknown[] = [];

      await proxy.onClientConnect(client, { username: "alice" }, createContext(room, {
        append: (input) => {
          appended.push(input);

          return Promise.resolve(true);
        }
      }));
      assert.deepEqual(sent, [{ type: "welcome", greeting: "hi" }]);
      assert.equal(appended.length, 1);
      assert.deepEqual(appended[0], {
        assetType: "fixture",
        assetId: "A",
        eventType: "connected",
        eventData: { username: "alice" }
      });
      sent.length = 0;

      await proxy.onMessage("A", { compute: true }, createContext(room));
      assert.equal(sent.length, 1);
      assert.equal((sent[0] as { type: string; }).type, "result");
      sent.length = 0;

      await proxy.onMessage("A", { hello: "world" }, createContext(room, {
        list: () => Promise.resolve([
          {
            eventId: 1,
            assetType: "fixture",
            assetId: "A",
            eventType: "connected",
            eventData: {},
            eventVersion: 1,
            createdAt: ""
          }
        ])
      }));
      assert.deepEqual(sent, [{ type: "history", count: 1 }]);
      sent.length = 0;

      await proxy.onClientDisconnect("A", createContext(room));
      assert.deepEqual(sent, [{ type: "bye" }]);
    }
    finally {
      await proxy.close();
    }
  });
});
