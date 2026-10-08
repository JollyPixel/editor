// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PendingCallRegistry } from "#src/server/extension/worker/PendingCallRegistry.ts";
import { PendingCallTimeoutError } from "#src/server/extension/worker/errors/PendingCallTimeoutError.ts";

describe("PendingCallRegistry — resolve", () => {
  test("resolves the promise returned by create() with the given id", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create();

    assert.strictEqual(registry.resolve(id, "value"), true);
    assert.strictEqual(await promise, "value");
  });

  test("returns false and does nothing for an unknown id", () => {
    const registry = new PendingCallRegistry<string>();

    assert.strictEqual(registry.resolve("unknown", "value"), false);
  });

  test("resolving twice only settles the promise once", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create();

    assert.strictEqual(registry.resolve(id, "first"), true);
    assert.strictEqual(registry.resolve(id, "second"), false);
    assert.strictEqual(await promise, "first");
  });
});

describe("PendingCallRegistry — reject", () => {
  test("rejects the promise returned by create() with the given id", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create();

    assert.strictEqual(registry.reject(id, new Error("boom")), true);
    await assert.rejects(promise, /boom/);
  });

  test("returns false for an unknown id", () => {
    const registry = new PendingCallRegistry<string>();

    assert.strictEqual(registry.reject("unknown", new Error("boom")), false);
  });
});

describe("PendingCallRegistry — ids", () => {
  test("assigns a distinct id to each pending call", () => {
    const registry = new PendingCallRegistry<string>();

    const first = registry.create();
    const second = registry.create();

    assert.notEqual(first.id, second.id);
  });

  test("resolving one pending call does not affect another", async() => {
    const registry = new PendingCallRegistry<string>();

    const first = registry.create();
    const second = registry.create();
    const secondRejection = assert.rejects(second.promise, /second failed/);

    registry.resolve(first.id, "first");
    registry.reject(second.id, new Error("second failed"));

    assert.strictEqual(await first.promise, "first");
    await secondRejection;
  });
});

describe("PendingCallRegistry — rejectAll", () => {
  test("rejects every still-pending call with the given error", async() => {
    const registry = new PendingCallRegistry<string>();

    const first = registry.create();
    const second = registry.create();
    const firstRejection = assert.rejects(first.promise, /shutdown/);
    const secondRejection = assert.rejects(second.promise, /shutdown/);

    registry.rejectAll(new Error("shutdown"));

    await firstRejection;
    await secondRejection;
  });

  test("clears pending entries, so a later resolve/reject on the same id is a no-op", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create();
    const rejection = assert.rejects(promise, /shutdown/);

    registry.rejectAll(new Error("shutdown"));

    assert.strictEqual(registry.resolve(id, "late"), false);
    await rejection;
  });
});

describe("PendingCallRegistry — timeoutMs", () => {
  test("rejects with a PendingCallTimeoutError once the timeout elapses", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const registry = new PendingCallRegistry<string>();
    const { promise } = registry.create({ timeoutMs: 50 });
    const rejection = assert.rejects(promise, PendingCallTimeoutError);

    t.mock.timers.tick(50);

    await rejection;
  });

  test("uses the given timeoutMessage", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const registry = new PendingCallRegistry<string>();
    const { promise } = registry.create({
      timeoutMs: 50,
      timeoutMessage: "custom timeout"
    });
    const rejection = assert.rejects(promise, /custom timeout/);

    t.mock.timers.tick(50);

    await rejection;
  });

  test("keeps the call pending until the timeout elapses", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create({ timeoutMs: 50 });

    t.mock.timers.tick(49);

    assert.strictEqual(registry.resolve(id, "in time"), true);
    assert.strictEqual(await promise, "in time");
  });

  test("never times out when timeoutMs is omitted", async(t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create();

    t.mock.timers.tick(3_600_000);

    assert.strictEqual(registry.resolve(id, "late"), true);
    assert.strictEqual(await promise, "late");
  });
});
