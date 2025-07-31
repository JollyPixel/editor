// Import Node.js Dependencies
import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Timer } from "../src/index.js";

describe("Timer", () => {
  let callbackExecuted: boolean;
  let callbackCount: number;

  beforeEach(() => {
    callbackExecuted = false;
    callbackCount = 0;
  });

  test("should initialize with default values", () => {
    const timer = new Timer();

    assert.equal(timer.interval, 60);
    assert.equal(timer.loop, true);
    // Timer should be started by default (autoStart = true)
    assert.equal(timer.walk(), false);
  });

  test("should initialize with custom interval and options", () => {
    // eslint-disable-next-line func-style
    const callback = () => {
      callbackExecuted = true;
    };

    const timer = new Timer(30, {
      autoStart: false,
      loop: false,
      callback
    });

    assert.equal(timer.interval, 30);
    assert.equal(timer.loop, false);
    // Timer should not be started (autoStart = false)
    assert.equal(timer.walk(), false);
    assert.equal(callbackExecuted, false);
  });

  test("should not execute callback when not started", () => {
    const timer = new Timer(1, {
      autoStart: false,
      callback: () => {
        callbackExecuted = true;
      }
    });

    assert.equal(timer.walk(), false);
    assert.equal(callbackExecuted, false);
  });

  test("should start timer manually", () => {
    const timer = new Timer(2, {
      autoStart: false,
      callback: () => {
        callbackExecuted = true;
      }
    });

    timer.start();

    // First tick should not trigger callback
    assert.equal(timer.walk(), false);
    // Second tick should trigger callback (interval = 1)
    assert.equal(timer.walk(), true);
    assert.equal(callbackExecuted, true);
  });

  test("should execute callback after interval ticks", () => {
    const timer = new Timer(3, {
      callback: () => {
        callbackExecuted = true;
      }
    });

    // Ticks 1 and 2 should not trigger callback
    assert.equal(timer.walk(), false);
    assert.equal(callbackExecuted, false);
    assert.equal(timer.walk(), false);
    assert.equal(callbackExecuted, false);

    // Tick 3 should trigger callback
    assert.equal(timer.walk(), true);
    assert.equal(callbackExecuted, true);
  });

  test("should reset tick counter after callback execution", () => {
    const timer = new Timer(2, {
      callback: () => {
        callbackCount++;
      }
    });

    // First cycle
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 1);

    // Second cycle should start from 0 again
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 2);
  });

  test("should loop by default", () => {
    const timer = new Timer(2, {
      callback: () => {
        callbackCount++;
      }
    });

    // Execute multiple cycles
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 1);

    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 2);

    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 3);
  });

  test("should stop after one execution when loop is false", () => {
    const timer = new Timer(2, {
      loop: false,
      callback: () => {
        callbackCount++;
      }
    });

    // First cycle should execute callback and stop
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 1);

    // Further walks should return false and not execute callback
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), false);
    assert.equal(callbackCount, 1);
  });

  test("should handle zero interval", () => {
    const timer = new Timer(0, {
      callback: () => {
        callbackExecuted = true;
      }
    });

    // With interval 0, first walk should trigger callback immediately
    assert.equal(timer.walk(), true);
    assert.equal(callbackExecuted, true);
  });

  test("should handle timer restart after stop", () => {
    const timer = new Timer(2, {
      loop: false,
      callback: () => {
        callbackCount++;
      }
    });

    // Execute once and stop
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 1);

    // Timer should be stopped
    assert.equal(timer.walk(), false);

    // Restart timer
    timer.start();

    // Should work again
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
    assert.equal(callbackCount, 2);
  });

  test("should work without callback", () => {
    const timer = new Timer(2);

    // Should not throw error when no callback is provided
    assert.equal(timer.walk(), false);
    assert.equal(timer.walk(), true);
  });

  test("should handle callback that throws error", () => {
    const timer = new Timer(2, {
      callback: () => {
        throw new Error("Test error");
      }
    });

    assert.equal(timer.walk(), false);

    // Should propagate the error
    assert.throws(() => {
      timer.walk();
    }, /Test error/);
  });
});
