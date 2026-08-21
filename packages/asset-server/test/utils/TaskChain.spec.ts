// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TaskChain } from "#src/index.ts";

describe("TaskChain", () => {
  test("runs queued tasks one after another", async() => {
    const chain = new TaskChain();
    const order: string[] = [];
    function task(name: string, ms: number) {
      return async() => {
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
        order.push(name);
      };
    }

    await Promise.all([
      chain.run(task("slow", 20)),
      chain.run(task("fast", 0))
    ]);

    assert.deepEqual(order, ["slow", "fast"]);
  });

  test("resolves with the task's own result", async() => {
    const chain = new TaskChain();

    assert.strictEqual(await chain.run(async() => 42), 42);
  });

  test("a rejected task never breaks the chain behind it", async() => {
    const chain = new TaskChain();
    const order: string[] = [];

    const failing = chain.run(async() => {
      order.push("failing");
      throw new Error("boom");
    });

    await assert.rejects(failing, /boom/);
    await chain.run(async() => {
      order.push("after");
    });

    assert.deepEqual(order, ["failing", "after"]);
  });

  test("settled waits for pending work without queueing any", async() => {
    const chain = new TaskChain();
    let done = false;

    void chain.run(async() => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      done = true;
    });
    await chain.settled();

    assert.strictEqual(done, true);
  });

  test("settled swallows a rejection rather than surfacing it", async() => {
    const chain = new TaskChain();

    void chain.run(() => Promise.reject(new Error("boom"))).catch(() => null);

    await chain.settled();
  });
});
