// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PendingCallRegistry,
  PendingCallTimeoutError
} from "#src/server/extension/worker/PendingCallRegistry.ts";

describe("PendingCallRegistry — resolve", () => {
  test("resolves the promise returned by create() with the given id", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create();

    assert.strictEqual(registry.resolve(id, "value"), true);
    assert.strictEqual(await promise, "value");
  });

  test("returns false and does nothing for an unknown id", () => {
    const registry = new PendingCallRegistry<string>();

    // @ts-expect-error - testing an invalid id
    assert.strictEqual(registry.resolve(999, "value"), false);
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

    // @ts-expect-error - testing an invalid id
    assert.strictEqual(registry.reject(999, new Error("boom")), false);
  });
});

describe("PendingCallRegistry — ids", () => {
  test("assigns a distinct, incrementing id to each pending call", () => {
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

  test("does not affect calls already settled before it runs", async() => {
    const registry = new PendingCallRegistry<string>();

    const { id, promise } = registry.create();
    registry.resolve(id, "done");

    registry.rejectAll(new Error("shutdown"));

    assert.strictEqual(await promise, "done");
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
  test("rejects with a PendingCallTimeoutError once the timeout elapses", async() => {
    const registry = new PendingCallRegistry<string>();
    const { promise } = registry.create({ timeoutMs: 5 });

    await assert.rejects(promise, PendingCallTimeoutError);
  });

  test("uses the given timeoutMessage", async() => {
    const registry = new PendingCallRegistry<string>();
    const { promise } = registry.create({ timeoutMs: 5, timeoutMessage: "custom timeout" });

    await assert.rejects(promise, /custom timeout/);
  });

  test("does not fire once resolved before the timeout", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create({ timeoutMs: 50 });

    registry.resolve(id, "done");

    assert.strictEqual(await promise, "done");
  });

  test("does not fire once rejected before the timeout", async() => {
    const registry = new PendingCallRegistry<string>();
    const { id, promise } = registry.create({ timeoutMs: 50 });
    const rejection = assert.rejects(promise, /boom/);

    registry.reject(id, new Error("boom"));

    await rejection;
  });

  test("never times out when timeoutMs is omitted", () => {
    const registry = new PendingCallRegistry<string>();

    assert.doesNotThrow(() => registry.create());
  });
});
