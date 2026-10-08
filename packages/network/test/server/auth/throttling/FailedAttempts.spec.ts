// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { FailedAttempts } from "#src/server/auth/throttling/FailedAttempts.ts";

describe("FailedAttempts", () => {
  test("blocks an address once it reaches the limit inside the window", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const failures = new FailedAttempts({ limit: 2, windowMs: 1_000 });

    failures.record("10.0.0.1");
    t.mock.timers.tick(10);
    assert.strictEqual(failures.blocks("10.0.0.1"), false);
    failures.record("10.0.0.1");
    t.mock.timers.tick(10);

    assert.strictEqual(failures.blocks("10.0.0.1"), true);
    assert.strictEqual(failures.blocks("10.0.0.2"), false);
  });

  test("lifts the block once the window has passed", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const failures = new FailedAttempts({ limit: 1, windowMs: 1_000 });
    failures.record("10.0.0.1");

    t.mock.timers.tick(999);
    assert.strictEqual(failures.blocks("10.0.0.1"), true);
    t.mock.timers.tick(1);
    assert.strictEqual(failures.blocks("10.0.0.1"), false);
  });

  test("forgive() clears an address", () => {
    const failures = new FailedAttempts({ limit: 1, windowMs: 1_000 });
    failures.record("10.0.0.1");

    failures.forgive("10.0.0.1");

    assert.strictEqual(failures.blocks("10.0.0.1"), false);
  });

  test("evicts the oldest address when full", () => {
    const failures = new FailedAttempts({ limit: 1, windowMs: 1_000, capacity: 2 });

    failures.record("10.0.0.1");
    failures.record("10.0.0.2");
    failures.record("10.0.0.3");

    assert.strictEqual(failures.blocks("10.0.0.1"), false);
    assert.strictEqual(failures.blocks("10.0.0.2"), true);
    assert.strictEqual(failures.blocks("10.0.0.3"), true);
  });
});
