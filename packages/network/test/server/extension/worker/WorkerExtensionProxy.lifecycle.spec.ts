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
import { Server } from "#src/index.ts";
import { createFakeTransportFactory } from "../../../helpers/server/FakeWorkerTransport.ts";
import {
  createContext,
  createDescriptor,
  readyMessage
} from "../../../helpers/server/workerProxy.ts";

describe("WorkerExtensionProxy — crash and restart", () => {
  test("a dispatch that times out rejects and spawns a fresh worker", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor({ rpcTimeoutMs: 10 }),
      { logger: createLogger(), transportFactory: factory }
    );

    const pending = proxy.onMessage("A", {}, createContext());
    transports[0].simulateMessage(readyMessage());
    await flushMacrotask();
    t.mock.timers.tick(10);

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
    transports[0].simulateMessage(readyMessage());
    await flushMacrotask();

    transports[0].simulateError(new Error("boom"));

    await assert.rejects(pending, /boom/);
    assert.equal(transports.length, 2);
  });

  test(
    "exceeding the restart cap marks the extension dead; further dispatches are dropped without spawning",
    async(t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const { factory, transports } = createFakeTransportFactory();
      const proxy = new WorkerExtensionProxy(
        createDescriptor({ rpcTimeoutMs: 5, maxRestarts: 1, restartWindowMs: 60_000 }),
        { logger: createLogger(), transportFactory: factory }
      );

      const first = proxy.onMessage("A", {}, createContext());
      transports[0].simulateMessage(readyMessage());
      await flushMacrotask();
      t.mock.timers.tick(5);
      await assert.rejects(first, /timed out/);
      assert.equal(transports.length, 2);

      const second = proxy.onMessage("A", {}, createContext());
      transports[1].simulateMessage(readyMessage());
      await flushMacrotask();
      t.mock.timers.tick(5);
      await assert.rejects(second, /timed out/);
      assert.equal(transports.length, 2);

      await proxy.onMessage("A", {}, createContext());
      assert.equal(transports.length, 2);
    }
  );
});

describe("WorkerExtensionProxy — close", () => {
  test("terminates the current transport", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );

    await proxy.close();
    assert.equal(transports[0].terminated, true);
  });
});

describe("WorkerExtensionProxy — dispose", () => {
  test("terminates the transport and drops later dispatches", async() => {
    const { factory, transports } = createFakeTransportFactory();
    const proxy = new WorkerExtensionProxy(
      createDescriptor(),
      { logger: createLogger(), transportFactory: factory }
    );

    await proxy.dispose();
    await proxy.onMessage("A", {}, createContext());

    assert.equal(transports[0].terminated, true);
    assert.deepEqual(transports[0].sent, []);
  });
});

describe("Server worker ownership", () => {
  test("disposes a registered worker through its room exactly once", async(t) => {
    const { factory, transports } = createFakeTransportFactory();
    const server = new Server();
    const proxy = new WorkerExtensionProxy(createDescriptor(), {
      logger: server.logger,
      transportFactory: factory
    });
    const terminate = t.mock.method(transports[0], "terminate");
    server.register(proxy);

    await server.close();

    assert.equal(transports[0].terminated, true);
    assert.equal(terminate.mock.callCount(), 1);
  });
});
