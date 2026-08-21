// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ClientSessions } from "#src/server/ClientSessions.ts";

function handle(
  id: string
) {
  return { id, send: () => void 0 };
}

function flush(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

describe("ClientSessions", () => {
  test("opens and closes a session", () => {
    const sessions = new ClientSessions();

    sessions.open(handle("A"));
    assert.strictEqual(sessions.size, 1);
    assert.deepEqual([...sessions.get("A")!.rooms], []);

    sessions.close("A");
    assert.strictEqual(sessions.get("A"), undefined);
    assert.strictEqual(sessions.size, 0);
  });

  test("runs a client's tasks in arrival order", async() => {
    const sessions = new ClientSessions();
    const order: string[] = [];

    const first = sessions.enqueue("A", async() => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      order.push("first");
    });
    const second = sessions.enqueue("A", async() => {
      order.push("second");
    });

    await Promise.all([first, second]);
    assert.deepEqual(order, ["first", "second"]);
  });

  test("a rejected task does not stall the ones behind it", async() => {
    const sessions = new ClientSessions();
    const order: string[] = [];

    const failing = sessions.enqueue("A", () => Promise.reject(new Error("boom")));
    const next = sessions.enqueue("A", async() => {
      order.push("next");
    });

    await assert.rejects(failing, /boom/);
    await next;
    assert.deepEqual(order, ["next"]);
  });

  test("interleaved clients do not share a queue", async() => {
    const sessions = new ClientSessions();
    const order: string[] = [];

    const slow = sessions.enqueue("A", async() => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      order.push("A");
    });
    const fast = sessions.enqueue("B", async() => {
      order.push("B");
    });

    await Promise.all([slow, fast]);
    assert.deepEqual(order, ["B", "A"]);
  });

  test("a settled queue prunes itself so a disconnect leaks nothing", async() => {
    const sessions = new ClientSessions();

    sessions.open(handle("A"));
    await sessions.enqueue("A", async() => void 0);
    sessions.close("A");
    await flush();

    assert.strictEqual(sessions.pending, 0);
    assert.strictEqual(sessions.size, 0);
  });

  test("clear drops every session", () => {
    const sessions = new ClientSessions();

    sessions.open(handle("A"));
    sessions.open(handle("B"));
    sessions.clear();

    assert.strictEqual(sessions.size, 0);
  });
});
