// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Touchpad } from "../../../src/index.ts";
import {
  createConnectedTouchpadFixture,
  createTouch,
  type TouchpadCanvasAdapter
} from "./Touchpad.fixture.ts";

describe("Controls.Touchpad idle gating", () => {
  let touchpad: Touchpad;
  let canvas: TouchpadCanvasAdapter;

  beforeEach(() => {
    ({
      touchpad,
      canvas
    } = createConnectedTouchpadFixture());
  });

  afterEach(() => {
    touchpad.disconnect();
  });

  test("a full touch cycle still publishes every transition", () => {
    canvas.dispatchEvent(
      "touchstart",
      [createTouch(0, 10, 10)]
    );
    touchpad.update();
    assert.strictEqual(touchpad.isDown(0), true);
    assert.strictEqual(touchpad.wasStarted(0), true);

    touchpad.update();
    assert.strictEqual(touchpad.wasStarted(0), false);

    canvas.dispatchEvent(
      "touchend",
      [createTouch(0, 10, 10)]
    );
    touchpad.update();
    assert.strictEqual(touchpad.isDown(0), false);
    assert.strictEqual(touchpad.wasEnded(0), true);

    // The settling tick must run even though nothing is down.
    touchpad.update();
    assert.strictEqual(touchpad.wasEnded(0), false);
    assert.strictEqual(touchpad.wasActive, false);
  });

  test("stays quiet across many idle ticks and still wakes on the next touch", () => {
    for (let frame = 0; frame < 100; frame++) {
      touchpad.update();
    }
    assert.strictEqual(touchpad.wasActive, false);

    canvas.dispatchEvent(
      "touchstart",
      [createTouch(1, 20, 20)]
    );
    touchpad.update();

    assert.strictEqual(touchpad.wasStarted(1), true);
    assert.strictEqual(touchpad.wasActive, true);
  });
});
