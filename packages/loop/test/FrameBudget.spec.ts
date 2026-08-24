// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FrameBudget, ManualClock } from "../src/index.ts";

describe("Loop.FrameBudget", () => {
  let clock: ManualClock;
  let budget: FrameBudget;

  beforeEach(() => {
    clock = new ManualClock();
    budget = new FrameBudget(clock);
  });

  test("is expired before any budget is granted", () => {
    assert.strictEqual(budget.expired, true);
    assert.strictEqual(budget.remaining, 0);
    assert.strictEqual(budget.elapsed, 0);
    assert.strictEqual(budget.budget, 0);
  });

  test("counts down as the clock advances", () => {
    budget.start(4);

    assert.strictEqual(budget.budget, 4);
    assert.strictEqual(budget.remaining, 4);
    assert.strictEqual(budget.expired, false);

    clock.advance(3);
    assert.strictEqual(budget.remaining, 1);
    assert.strictEqual(budget.elapsed, 3);
    assert.strictEqual(budget.expired, false);

    clock.advance(1);
    assert.strictEqual(budget.remaining, 0);
    assert.strictEqual(budget.expired, true);
  });

  test("remaining never goes negative", () => {
    budget.start(4);
    clock.advance(100);

    assert.strictEqual(budget.remaining, 0);
    assert.strictEqual(budget.elapsed, 100);
  });

  test("a zero budget is expired immediately", () => {
    budget.start(0);

    assert.strictEqual(budget.expired, true);
    assert.strictEqual(budget.remaining, 0);
  });

  test("start() re-arms from the current time", () => {
    budget.start(4);
    clock.advance(10);
    assert.strictEqual(budget.expired, true);

    budget.start(4);
    assert.strictEqual(budget.expired, false);
    assert.strictEqual(budget.elapsed, 0);
    assert.strictEqual(budget.remaining, 4);
  });

  test("clear() revokes the budget", () => {
    budget.start(4);
    budget.clear();

    assert.strictEqual(budget.expired, true);
    assert.strictEqual(budget.remaining, 0);
    assert.strictEqual(budget.budget, 0);
  });

  test("rejects a negative or non-finite budget", () => {
    assert.throws(() => budget.start(-1), RangeError);
    assert.throws(() => budget.start(NaN), RangeError);
    assert.throws(() => budget.start(Infinity), RangeError);
  });

  test("drains a queue up to the deadline and leaves the rest", () => {
    const queue = Array.from({ length: 10 }, (_unused, index) => index);
    const done: number[] = [];

    budget.start(4);
    while (queue.length > 0 && !budget.expired) {
      done.push(queue.shift()!);
      // Each item costs a millisecond of wall time.
      clock.advance(1);
    }

    assert.deepStrictEqual(done, [0, 1, 2, 3]);
    assert.strictEqual(queue.length, 6);
  });
});
