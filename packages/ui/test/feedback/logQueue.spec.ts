// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LogQueue } from "../../src/feedback/LogQueue.ts";
import type { LogQueueOptions } from "../../src/feedback/LogQueue.types.ts";

interface PendingTimer {
  callback: () => void;
  at: number;
}

class ManualClock {
  #time = 0;
  #timers = new Map<number, PendingTimer>();
  #sequence = 0;

  get options(): LogQueueOptions {
    return {
      now: () => this.#time,
      schedule: (callback, delay) => {
        this.#sequence += 1;
        const handle = this.#sequence;
        this.#timers.set(handle, {
          callback,
          at: this.#time + delay
        });

        return () => {
          this.#timers.delete(handle);
        };
      }
    };
  }

  get pending(): number {
    return this.#timers.size;
  }

  advance(
    milliseconds: number
  ): void {
    this.#time += milliseconds;
    for (const [handle, timer] of [...this.#timers]) {
      if (timer.at <= this.#time) {
        this.#timers.delete(handle);
        timer.callback();
      }
    }
  }
}

function contentsOf(
  queue: LogQueue
): string[] {
  return queue.entries.map((entry) => String(entry.content));
}

describe("LogQueue", () => {
  test("keeps the newest entry first", () => {
    const queue = new LogQueue();
    queue.push("first");
    queue.push("second");

    assert.deepStrictEqual(contentsOf(queue), ["second", "first"]);
  });

  test("stamps entries with the injected clock", () => {
    const clock = new ManualClock();
    const queue = new LogQueue(clock.options);

    queue.push("first");
    clock.advance(250);
    queue.push("second");

    assert.deepStrictEqual(
      queue.entries.map((entry) => entry.createdAt),
      [250, 0]
    );
  });

  test("evicts the oldest entry beyond the cap", () => {
    const queue = new LogQueue({ max: 2 });
    queue.push("first");
    queue.push("second");
    queue.push("third");

    assert.deepStrictEqual(contentsOf(queue), ["third", "second"]);
  });

  test("expires an entry after its own grace period", () => {
    const clock = new ManualClock();
    const queue = new LogQueue({
      ...clock.options,
      gracePeriod: 1_000
    });

    queue.push("first");
    clock.advance(400);
    queue.push("second");

    clock.advance(600);
    assert.deepStrictEqual(contentsOf(queue), ["second"]);

    clock.advance(400);
    assert.deepStrictEqual(contentsOf(queue), []);
  });

  test("cancels the timer of an evicted entry", () => {
    const clock = new ManualClock();
    const queue = new LogQueue({
      ...clock.options,
      max: 1
    });

    queue.push("first");
    queue.push("second");

    assert.strictEqual(clock.pending, 1);
  });

  test("dismisses a known entry once", () => {
    const queue = new LogQueue();
    const id = queue.push("first");
    queue.push("second");

    const seen: number[] = [];
    queue.subscribe((entries) => seen.push(entries.length));

    queue.dismiss(id);
    queue.dismiss(id);
    queue.dismiss("log-unknown");

    assert.deepStrictEqual(contentsOf(queue), ["second"]);
    assert.deepStrictEqual(seen, [1]);
  });

  test("notifies subscribers until they unsubscribe", () => {
    const queue = new LogQueue();
    const seen: string[][] = [];
    const unsubscribe = queue.subscribe(
      (entries) => seen.push(entries.map((entry) => String(entry.content)))
    );

    queue.push("first");
    unsubscribe();
    queue.push("second");

    assert.deepStrictEqual(seen, [["first"]]);
  });

  test("clears every entry and its timers", () => {
    const clock = new ManualClock();
    const queue = new LogQueue(clock.options);
    queue.push("first");
    queue.push("second");

    queue.clear();

    assert.deepStrictEqual(contentsOf(queue), []);
    assert.strictEqual(clock.pending, 0);
  });

  test("clears nothing when already empty", () => {
    const queue = new LogQueue();
    const seen: number[] = [];
    queue.subscribe((entries) => seen.push(entries.length));

    queue.clear();

    assert.deepStrictEqual(seen, []);
  });

  test("drops timers and listeners on dispose", () => {
    const clock = new ManualClock();
    const queue = new LogQueue(clock.options);
    const seen: number[] = [];
    queue.subscribe((entries) => seen.push(entries.length));
    queue.push("first");

    queue.dispose();
    assert.strictEqual(clock.pending, 0);

    queue.push("second");
    assert.deepStrictEqual(seen, [1]);
  });

  test("keeps entries out when the cap is zero", () => {
    const clock = new ManualClock();
    const queue = new LogQueue({
      ...clock.options,
      max: 0
    });

    queue.push("first");

    assert.deepStrictEqual(contentsOf(queue), []);
    assert.strictEqual(clock.pending, 0);
  });
});
