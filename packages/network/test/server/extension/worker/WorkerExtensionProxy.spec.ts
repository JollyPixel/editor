// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setImmediate as flushMacrotask } from "node:timers/promises";

// Import Internal Dependencies
import { WorkerExtensionProxy } from "#src/server/extension/worker/WorkerExtensionProxy.ts";
import { createLogger } from "#src/server/logger.ts";
import { actionProtocols } from "../../../helpers/protocol/protocols.ts";
import { createFakeTransportFactory } from "../../../helpers/server/FakeWorkerTransport.ts";
import {
  createContext,
  createDescriptor,
  readyMessage
} from "../../../helpers/server/workerProxy.ts";

describe("WorkerExtensionProxy — readiness", () => {
  test("buffers a dispatch until the worker signals ready, then sends it", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );

    const pending = proxy.onMessage("A", { hello: "world" }, createContext());
    await flushMacrotask();
    assert.deepEqual(transports[0].sent, []);

    transports[0].simulateMessage(readyMessage());
    await flushMacrotask();
    assert.equal(transports[0].sent.length, 1);

    const sent = transports[0].dispatched();
    assert.equal(sent.type, "dispatch");
    assert.equal(sent.method, "onMessage");

    transports[0].simulateMessage({ type: "dispatch-result", id: sent.id, ok: true });
    await pending;
  });

  test("forwards a resync to the worker", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );
    transports[0].simulateMessage(readyMessage());

    const pending = proxy.onResync("A", createContext());
    await flushMacrotask();

    const sent = transports[0].dispatched();
    assert.equal(sent.method, "onResync");
    assert.deepEqual(sent.args, ["A"]);
    transports[0].simulateMessage({ type: "dispatch-result", id: sent.id, ok: true });
    await pending;
  });
});

describe("WorkerExtensionProxy — hooks the worker does not implement", () => {
  test("resolves without posting a dispatch", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );

    transports[0].simulateMessage(readyMessage(["onMessage"]));

    await proxy.onClientConnect(
      { id: "A", send: () => void 0 },
      {
        clientId: "A",
        identity: { subject: "A", role: "default" },
        profile: {},
        presence: {}
      },
      createContext()
    );
    await proxy.onClientDisconnect("A", createContext());

    assert.deepEqual(transports[0].sent, []);
  });

  test("still dispatches the hooks the worker does implement", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );

    transports[0].simulateMessage(readyMessage(["onMessage"]));

    const pending = proxy.onMessage("A", { hello: "world" }, createContext());
    await flushMacrotask();

    const sent = transports[0].dispatched();
    assert.equal(sent.method, "onMessage");

    transports[0].simulateMessage({ type: "dispatch-result", id: sent.id, ok: true });
    await pending;
  });
});

describe("WorkerExtensionProxy — protocols", () => {
  test("exposes the descriptor's protocols without touching the worker transport", () => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor({ protocols: actionProtocols }),
      { logger: createLogger(), transportFactory: factory }
    );

    assert.equal(proxy.protocols, actionProtocols);
    assert.deepEqual(transports[0].sent, []);
  });
});

describe("WorkerExtensionProxy — context-call routing", () => {
  test(
    "room.broadcast and client.send context-calls use the stable broadcaster, not the in-flight dispatch",
    async() => {
      const { factory, transports } = createFakeTransportFactory();
      const proxy = new WorkerExtensionProxy(
        createDescriptor(),
        { logger: createLogger(), transportFactory: factory }
      );

      const broadcasts: unknown[] = [];
      const sends: [string, unknown][] = [];
      const context = createContext();
      context.room.broadcast = (payload) => broadcasts.push(payload);
      context.room.sendTo = (clientId, payload) => sends.push([clientId, payload]);

      const pending = proxy.onMessage("A", {}, context);
      transports[0].simulateMessage(readyMessage());
      await flushMacrotask();
      const dispatchMsg = transports[0].dispatched();

      transports[0].simulateMessage(
        { type: "context-call", method: "room.broadcast", args: [{ hello: "world" }] }
      );
      transports[0].simulateMessage(
        { type: "context-call", method: "client.send", args: ["A", { type: "ack" }] }
      );
      await flushMacrotask();

      assert.deepEqual(broadcasts, [{ hello: "world" }]);
      assert.deepEqual(sends, [["A", { type: "ack" }]]);

      transports[0].simulateMessage({ type: "dispatch-result", id: dispatchMsg.id, ok: true });
      await pending;
    }
  );
});

describe("WorkerExtensionProxy — identity", () => {
  test("forwards the context identity with each dispatch", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );
    transports[0].simulateMessage(readyMessage());

    const pending = proxy.onMessage("A", {}, createContext());
    await flushMacrotask();
    const sent = transports[0].dispatched();
    transports[0].simulateMessage({
      type: "dispatch-result",
      id: sent.id,
      ok: true
    });
    await pending;

    assert.deepEqual(sent.identity, {
      subject: "client-1",
      role: "default"
    });
  });
});
