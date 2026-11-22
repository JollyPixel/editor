// Import Node.js Dependencies
import {
  describe,
  test,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Timers } from "../../src/systems/Timers.ts";

describe("Systems.Timers", () => {
  test("fires a timer once its delay has elapsed, then drops it", () => {
    const timers = new Timers();
    const callback = mock.fn();
    const timer = timers.schedule(1, callback);

    timers.advance(0.5);
    assert.strictEqual(callback.mock.callCount(), 0);

    timers.advance(1);
    timers.advance(2);

    assert.strictEqual(callback.mock.callCount(), 1);
    assert.strictEqual(timer.active, false);
    assert.strictEqual(timers.pending, false);
  });

  test("fires a repeating timer once per advance, even behind schedule", () => {
    const timers = new Timers();
    const callback = mock.fn();
    timers.schedule(1, callback, { repeat: true });

    timers.advance(1);
    timers.advance(5);
    timers.advance(5.5);
    timers.advance(6);

    assert.strictEqual(callback.mock.callCount(), 3);
    assert.strictEqual(timers.pending, true);
  });

  test("never fires a timer cancelled before it is due, even by an earlier callback", () => {
    const timers = new Timers();
    const late = mock.fn();
    const lateTimer = timers.schedule(2, late);
    timers.schedule(1, () => lateTimer.cancel());

    timers.advance(3);

    assert.strictEqual(late.mock.callCount(), 0);
    assert.strictEqual(lateTimer.active, false);
  });

  test("fires the timers of one advance in due order", () => {
    const timers = new Timers();
    const fired: string[] = [];
    timers.schedule(2, () => fired.push("late"));
    timers.schedule(1, () => fired.push("early"));

    timers.advance(2);

    assert.deepEqual(fired, ["early", "late"]);
  });

  test("refuses a negative delay and a repeating timer without delay", () => {
    const timers = new Timers();

    assert.throws(() => timers.schedule(-1, mock.fn()), RangeError);
    assert.throws(() => timers.schedule(0, mock.fn(), { repeat: true }), RangeError);
  });
});
