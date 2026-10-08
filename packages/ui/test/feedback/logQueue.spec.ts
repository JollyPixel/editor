// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LogQueue } from "../../src/feedback/LogQueue.ts";

function contentsOf(
  queue: LogQueue
): string[] {
  return queue.entries.map((entry) => String(entry.content));
}

describe("LogQueue", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test("keeps the newest entry first", () => {
    const queue = new LogQueue();
    queue.push("first");
    queue.push("second");

    assert.deepStrictEqual(contentsOf(queue), ["second", "first"]);
  });

  test("stamps entries with the current time", () => {
    const queue = new LogQueue();

    queue.push("first");
    mock.timers.tick(250);
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
    const queue = new LogQueue({
      gracePeriod: 1_000
    });

    queue.push("first");
    mock.timers.tick(400);
    queue.push("second");

    mock.timers.tick(600);
    assert.deepStrictEqual(contentsOf(queue), ["second"]);

    mock.timers.tick(400);
    assert.deepStrictEqual(contentsOf(queue), []);
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

  test("clears every entry", () => {
    const queue = new LogQueue();
    queue.push("first");
    queue.push("second");

    queue.clear();

    assert.deepStrictEqual(contentsOf(queue), []);
  });

  test("clears nothing when already empty", () => {
    const queue = new LogQueue();
    const seen: number[] = [];
    queue.subscribe((entries) => seen.push(entries.length));

    queue.clear();

    assert.deepStrictEqual(seen, []);
  });

  test("drops entries and listeners on dispose", () => {
    const queue = new LogQueue();
    const seen: number[] = [];
    queue.subscribe((entries) => seen.push(entries.length));
    queue.push("first");

    queue.dispose();
    queue.push("second");

    assert.deepStrictEqual(seen, [1]);
  });

  test("keeps entries out when the cap is zero", () => {
    const queue = new LogQueue({ max: 0 });

    queue.push("first");

    assert.deepStrictEqual(contentsOf(queue), []);
  });
});
