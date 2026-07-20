// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TypedEventEmitter } from "../../src/utils/EventEmitter.ts";

type TestEvent =
  | { type: "foo"; value: number; }
  | { type: "bar"; label: string; };

/**
 * `emit` is protected on TypedEventEmitter (only an owning subclass should
 * trigger its own events), so tests drive it through this thin subclass.
 */
class TestEmitter extends TypedEventEmitter<TestEvent> {
  trigger<T extends TestEvent["type"]>(
    event: Extract<TestEvent, { type: T; }>
  ): void {
    this.emit(event);
  }
}

describe("TypedEventEmitter", () => {
  test("invokes a listener registered for the emitted event type", () => {
    const emitter = new TestEmitter();
    const events: TestEvent[] = [];
    emitter.on("foo", (e) => events.push(e));

    emitter.trigger({ type: "foo", value: 1 });

    assert.deepStrictEqual(events, [{ type: "foo", value: 1 }]);
  });

  test("does not invoke listeners registered for a different event type", () => {
    const emitter = new TestEmitter();
    const events: TestEvent[] = [];
    emitter.on("bar", (e) => events.push(e));

    emitter.trigger({ type: "foo", value: 1 });

    assert.strictEqual(events.length, 0);
  });

  test("supports multiple listeners for the same event type", () => {
    const emitter = new TestEmitter();
    let firstCalls = 0;
    let secondCalls = 0;
    emitter.on("foo", () => {
      firstCalls++;
    });
    emitter.on("foo", () => {
      secondCalls++;
    });

    emitter.trigger({ type: "foo", value: 1 });

    assert.strictEqual(firstCalls, 1);
    assert.strictEqual(secondCalls, 1);
  });

  test("off() stops a listener from receiving further events", () => {
    const emitter = new TestEmitter();
    const events: TestEvent[] = [];
    function listener(
      e: Extract<TestEvent, { type: "foo"; }>
    ): void {
      events.push(e);
    }

    emitter.on("foo", listener);
    emitter.trigger({ type: "foo", value: 1 });
    emitter.off("foo", listener);
    emitter.trigger({ type: "foo", value: 2 });

    assert.strictEqual(events.length, 1);
  });

  test("off() on an unregistered listener is a no-op", () => {
    const emitter = new TestEmitter();

    function listener(): void {
      // never registered, never expected to run
    }

    assert.doesNotThrow(() => emitter.off("foo", listener));
  });

  test("emit() with no listeners registered is a no-op", () => {
    const emitter = new TestEmitter();

    assert.doesNotThrow(() => emitter.trigger({ type: "foo", value: 1 }));
  });

  test("a listener removing itself mid-emit does not affect the current dispatch", () => {
    const emitter = new TestEmitter();
    const events: TestEvent[] = [];
    function listener(
      e: Extract<TestEvent, { type: "foo"; }>
    ): void {
      events.push(e);
      emitter.off("foo", listener);
    }

    emitter.on("foo", listener);
    emitter.trigger({ type: "foo", value: 1 });

    assert.strictEqual(events.length, 1);
  });
});
