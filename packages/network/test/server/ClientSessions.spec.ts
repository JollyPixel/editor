// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate as flush } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { identityOf } from "../helpers/identity.ts";
import { ClientSessions } from "#src/server/ClientSessions.ts";

function handle(
  id: string
) {
  return { id, send: () => void 0 };
}

describe("ClientSessions", () => {
  test("opens and closes a session", () => {
    const sessions = new ClientSessions();

    sessions.open(handle("A"), identityOf(handle("A")));
    assert.strictEqual(sessions.size, 1);
    const session = sessions.get("A");
    assert.ok(session);
    assert.deepEqual([...session.rooms], []);

    sessions.close("A");
    assert.strictEqual(sessions.get("A"), undefined);
    assert.strictEqual(sessions.size, 0);
  });

  test("clear drops every session and pending lane", () => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();

    sessions.open(handle("A"), identityOf(handle("A")));
    sessions.open(handle("B"), identityOf(handle("B")));
    sessions.enqueue("A", () => gate.promise, "room-1");
    sessions.clear();

    assert.strictEqual(sessions.size, 0);
    assert.strictEqual(sessions.pending, 0);
    gate.resolve();
  });
});

describe("ClientSessions — lanes", () => {
  test("keeps arrival order within one lane", async() => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();
    const order: string[] = [];

    const first = sessions.enqueue("A", async() => {
      await gate.promise;
      order.push("first");
    }, "room-1");
    const second = sessions.enqueue("A", async() => {
      order.push("second");
    }, "room-1");
    await flush();
    assert.deepEqual(order, []);

    gate.resolve();
    await Promise.all([first, second]);
    assert.deepEqual(order, ["first", "second"]);
  });

  test("a rejected task does not stall the ones behind it", async() => {
    const sessions = new ClientSessions();
    const order: string[] = [];

    const failing = sessions.enqueue(
      "A",
      () => Promise.reject(new Error("boom")),
      "room-1"
    );
    const next = sessions.enqueue("A", async() => {
      order.push("next");
    }, "room-1");

    await assert.rejects(failing, /boom/);
    await next;
    assert.deepEqual(order, ["next"]);
  });

  test("a slow lane does not hold up another lane of the same client", async() => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();
    const order: string[] = [];

    const slow = sessions.enqueue("A", async() => {
      await gate.promise;
      order.push("slow");
    }, "room-1");
    sessions.enqueue("A", async() => {
      order.push("fast");
    }, "room-2");
    await flush();
    assert.deepEqual(order, ["fast"]);

    gate.resolve();
    await slow;
    assert.deepEqual(order, ["fast", "slow"]);
  });

  test("the same lane name on two clients stays independent", async() => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();
    const order: string[] = [];

    const slow = sessions.enqueue("A", async() => {
      await gate.promise;
      order.push("A");
    }, "room-1");
    sessions.enqueue("B", async() => {
      order.push("B");
    }, "room-1");
    await flush();
    assert.deepEqual(order, ["B"]);

    gate.resolve();
    await slow;
    assert.deepEqual(order, ["B", "A"]);
  });

  test("drain settles every lane the client holds", async() => {
    const sessions = new ClientSessions();
    const gate = Promise.withResolvers<void>();
    const order: string[] = [];
    let drained = false;

    sessions.enqueue("A", async() => {
      await gate.promise;
      order.push("slow");
    }, "room-1");
    sessions.enqueue(
      "A",
      () => Promise.reject(new Error("boom")),
      "room-2"
    ).catch(() => void 0);

    const draining = sessions.drain("A").then(() => {
      drained = true;
    });
    await flush();
    assert.strictEqual(drained, false);

    gate.resolve();
    await draining;
    assert.deepEqual(order, ["slow"]);
  });

  test("every settled lane prunes itself", async() => {
    const sessions = new ClientSessions();

    await Promise.all([
      sessions.enqueue("A", async() => void 0, "room-1"),
      sessions.enqueue("A", async() => void 0, "room-2")
    ]);
    await flush();

    assert.strictEqual(sessions.pending, 0);
  });
});
