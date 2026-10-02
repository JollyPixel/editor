// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Touchpad } from "../../../src/index.ts";
import {
  createConnectedTouchpadFixture,
  createTouch,
  type TouchpadCanvasAdapter
} from "./Touchpad.fixture.ts";

describe("Controls.Touchpad frame sampling", () => {
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

  test("a touch sampled on a frame without a step reaches the next step once", () => {
    canvas.dispatchEvent("touchstart", [createTouch(1, 10, 10)]);

    touchpad.sample();
    touchpad.publish("frame");
    assert.strictEqual(touchpad.touches[1].wasStarted, true);

    touchpad.update();
    assert.strictEqual(touchpad.touches[1].wasStarted, true);

    touchpad.publish("frame");
    assert.strictEqual(touchpad.touches[1].wasStarted, false);

    touchpad.update();
    assert.strictEqual(touchpad.touches[1].wasStarted, false);
    assert.strictEqual(touchpad.touches[1].isDown, true);
  });

  test("the published frame shows edges from every step since the last frame", () => {
    canvas.dispatchEvent("touchstart", [createTouch(0, 10, 10)]);
    touchpad.update();
    canvas.dispatchEvent("touchend", [createTouch(0, 10, 10)]);
    touchpad.update();

    touchpad.publish("frame");

    assert.strictEqual(touchpad.touches[0].wasStarted, true);
    assert.strictEqual(touchpad.touches[0].wasEnded, true);
  });
});
