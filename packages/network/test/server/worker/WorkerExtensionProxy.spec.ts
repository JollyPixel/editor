// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate as flushMacrotask } from "node:timers/promises";

// Import Internal Dependencies
import { WorkerExtensionProxy } from "#src/server/worker/WorkerExtensionProxy.ts";
import { createLogger } from "#src/server/logger.ts";
import type {
  RoomContext,
  WorkerExtensionDescriptor
} from "#src/index.ts";
import { createFakeTransportFactory } from "../../helpers/FakeWorkerTransport.ts";

function createContext(
  overrides: Partial<RoomContext["eventStore"]> = {}
): RoomContext {
  return {
    room: {
      broadcast: () => void 0,
      sendTo: () => void 0
    },
    eventStore: {
      append: overrides.append ?? (() => Promise.resolve(true)),
      list: overrides.list ?? (() => Promise.resolve([]))
    }
  };
}

function createDescriptor(
  overrides: Partial<WorkerExtensionDescriptor> = {}
): WorkerExtensionDescriptor {
  return {
    id: "room-1",
    name: "ext",
    modulePath: "irrelevant.js",
    ...overrides
  };
}

describe("WorkerExtensionProxy — readiness", () => {
  test("buffers a dispatch until the worker signals ready, then sends it", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(createDescriptor(), { logger: createLogger(), transportFactory: factory });

    const pending = proxy.onMessage("A", { hello: "world" }, createContext());
    await flushMacrotask();
    assert.deepEqual(transports[0].sent, []);

    transports[0].simulateMessage({ type: "ready" });
    await flushMacrotask();
    assert.equal(transports[0].sent.length, 1);

    const sent = transports[0].sent[0] as { type: string; id: string; method: string; };
    assert.equal(sent.type, "dispatch");
    assert.equal(sent.method, "onMessage");

    transports[0].simulateMessage({ type: "dispatch-result", id: sent.id, ok: true });
    await pending;
  });
});

describe("WorkerExtensionProxy — getEventName", () => {
  test("runs on the main thread, never touching the worker transport", () => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor({ getEventName: (payload) => (payload as { action: string; }).action }),
      { logger: createLogger(), transportFactory: factory }
    );

    assert.equal(proxy.getEventName({ action: "voxel-set" }), "voxel-set");
    assert.deepEqual(transports[0].sent, []);
  });

  test("falls back to the base Extension's throwing default when the descriptor doesn't supply one", () => {
    const { factory } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(createDescriptor(), { logger: createLogger(), transportFactory: factory });

    assert.throws(() => proxy.getEventName({}), /must be implemented/);
  });
});

describe("WorkerExtensionProxy — context-call routing", () => {
  test("routes an eventStore.append context-call to the real RoomContext for the in-flight dispatch", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(createDescriptor(), { logger: createLogger(), transportFactory: factory });

    const appended: unknown[] = [];
    const context = createContext({
      append: (input) => {
        appended.push(input);

        return Promise.resolve(true);
      }
    });

    const pending = proxy.onMessage("A", {}, context);
    transports[0].simulateMessage({ type: "ready" });
    await flushMacrotask();
    const dispatchMsg = transports[0].sent[0] as { id: string; };

    transports[0].simulateMessage({
      type: "context-call",
      id: "call-1",
      method: "eventStore.append",
      args: [{ assetType: "texture", assetId: "a1", eventType: "e", eventData: {} }]
    });
    await flushMacrotask();

    assert.equal(appended.length, 1);
    const response = transports[0].sent.at(-1) as { type: string; id: string; ok: boolean; value: boolean; };
    assert.equal(response.type, "context-response");
    assert.equal(response.ok, true);
    assert.equal(response.value, true);

    transports[0].simulateMessage({ type: "dispatch-result", id: dispatchMsg.id, ok: true });
    await pending;
  });

  test("room.broadcast and client.send context-calls use the stable broadcaster, not the in-flight dispatch", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(createDescriptor(), { logger: createLogger(), transportFactory: factory });

    const broadcasts: unknown[] = [];
    const sends: [string, unknown][] = [];
    const context = createContext();
    context.room.broadcast = (payload) => broadcasts.push(payload);
    context.room.sendTo = (clientId, payload) => sends.push([clientId, payload]);

    const pending = proxy.onMessage("A", {}, context);
    transports[0].simulateMessage({ type: "ready" });
    await flushMacrotask();
    const dispatchMsg = transports[0].sent[0] as { id: string; };

    transports[0].simulateMessage({ type: "context-call", method: "room.broadcast", args: [{ hello: "world" }] });
    transports[0].simulateMessage({ type: "context-call", method: "client.send", args: ["A", { type: "ack" }] });
    await flushMacrotask();

    assert.deepEqual(broadcasts, [{ hello: "world" }]);
    assert.deepEqual(sends, [["A", { type: "ack" }]]);

    transports[0].simulateMessage({ type: "dispatch-result", id: dispatchMsg.id, ok: true });
    await pending;
  });
});

describe("WorkerExtensionProxy — crash and restart", () => {
  test("a dispatch that times out rejects and spawns a fresh worker", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor({ rpcTimeoutMs: 10 }),
      { logger: createLogger(), transportFactory: factory }
    );

    const pending = proxy.onMessage("A", {}, createContext());
    transports[0].simulateMessage({ type: "ready" });

    await assert.rejects(pending, /timed out/);
    assert.equal(transports.length, 2);
  });

  test("a worker 'error' event rejects the in-flight dispatch and spawns a fresh worker", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );

    const pending = proxy.onMessage("A", {}, createContext());
    transports[0].simulateMessage({ type: "ready" });
    await flushMacrotask();

    transports[0].simulateError(new Error("boom"));

    await assert.rejects(pending, /boom/);
    assert.equal(transports.length, 2);
  });

  test("exceeding the restart cap marks the extension dead; further dispatches are dropped without spawning", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor({ rpcTimeoutMs: 5, maxRestarts: 1, restartWindowMs: 60_000 }),
      { logger: createLogger(), transportFactory: factory }
    );

    const first = proxy.onMessage("A", {}, createContext());
    transports[0].simulateMessage({ type: "ready" });
    await assert.rejects(first, /timed out/);
    assert.equal(transports.length, 2);

    const second = proxy.onMessage("A", {}, createContext());
    transports[1].simulateMessage({ type: "ready" });
    await assert.rejects(second, /timed out/);
    assert.equal(transports.length, 2);

    await proxy.onMessage("A", {}, createContext());
    assert.equal(transports.length, 2);
  });
});

describe("WorkerExtensionProxy — close", () => {
  test("terminates the current transport", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(createDescriptor(), { logger: createLogger(), transportFactory: factory });

    await proxy.close();
    assert.equal(transports[0].terminated, true);
  });
});
