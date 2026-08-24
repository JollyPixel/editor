// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ManualClock, PerformanceClock } from "../src/index.ts";

describe("Loop.ManualClock", () => {
  test("starts at zero unless an initial time is given", () => {
    assert.strictEqual(new ManualClock().now(), 0);
    assert.strictEqual(new ManualClock(1234).now(), 1234);
  });

  test("advance() moves forward and returns the new time", () => {
    const clock = new ManualClock(100);

    assert.strictEqual(clock.advance(50), 150);
    assert.strictEqual(clock.advance(50), 200);
    assert.strictEqual(clock.now(), 200);
  });

  test("set() jumps to an absolute time", () => {
    const clock = new ManualClock(100);

    assert.strictEqual(clock.set(10), 10);
    assert.strictEqual(clock.now(), 10);
  });
});

describe("Loop.PerformanceClock", () => {
  test("reads performance.now()", () => {
    const clock = new PerformanceClock();
    const before = performance.now();
    const value = clock.now();

    assert.ok(value >= before);
    assert.ok(value <= performance.now());
  });
});
