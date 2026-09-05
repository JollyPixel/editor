// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Touchpad } from "../../../src/index.ts";
import {
  createConnectedTouchpadFixture,
  createTouch,
  type TouchpadCanvasAdapter
} from "./Touchpad.fixture.ts";

describe("Controls.Touchpad lifecycle", () => {
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

  test("should properly connect and disconnect event listeners", () => {
    const addEventListener = mock.fn();
    const removeEventListener = mock.fn();

    const mockCanvas = {
      addEventListener,
      removeEventListener
    };

    // @ts-expect-error
    const newTouchpad = new Touchpad({ canvas: mockCanvas });

    newTouchpad.connect();

    assert.strictEqual(
      addEventListener.mock.calls.length,
      4
    );
    assert.strictEqual(
      addEventListener.mock.calls[0].arguments[0],
      "touchstart"
    );
    assert.strictEqual(
      addEventListener.mock.calls[1].arguments[0],
      "touchend"
    );
    assert.strictEqual(
      addEventListener.mock.calls[2].arguments[0],
      "touchmove"
    );
    assert.strictEqual(
      addEventListener.mock.calls[3].arguments[0],
      "touchcancel"
    );

    newTouchpad.disconnect();

    assert.strictEqual(
      removeEventListener.mock.calls.length,
      4
    );
    assert.strictEqual(
      removeEventListener.mock.calls[0].arguments[0],
      "touchstart"
    );
    assert.strictEqual(
      removeEventListener.mock.calls[1].arguments[0],
      "touchend"
    );
    assert.strictEqual(
      removeEventListener.mock.calls[2].arguments[0],
      "touchmove"
    );
    assert.strictEqual(
      removeEventListener.mock.calls[3].arguments[0],
      "touchcancel"
    );
  });

  test("should handle complete touch lifecycle", () => {
    const events: string[] = [];
    touchpad.on("start", () => events.push("start"));
    touchpad.on("move", () => events.push("move"));
    touchpad.on("end", () => events.push("end"));

    const touch = createTouch(0, 100, 150);

    canvas.dispatchEvent("touchstart", [touch]);
    touchpad.update();

    canvas.dispatchEvent("touchmove", [createTouch(0, 110, 160)]);
    touchpad.update();

    canvas.dispatchEvent("touchend", [touch]);
    touchpad.update();

    assert.deepStrictEqual(events, ["start", "move", "end"]);
    assert.strictEqual(touchpad.touches[0].wasStarted, false);
    assert.strictEqual(touchpad.touches[0].wasEnded, true);
  });

  test("should handle simultaneous multi-touch gestures", () => {
    const touch1 = createTouch(0, 100, 150);
    const touch2 = createTouch(1, 200, 250);
    const touch3 = createTouch(2, 300, 350);

    canvas.dispatchEvent("touchstart", [touch1, touch2, touch3]);

    assert.strictEqual(touchpad.isOneFingerGesture, true);
    assert.strictEqual(touchpad.isTwoFingerGesture, true);
    assert.strictEqual(touchpad.isThreeFingerGesture, true);

    canvas.dispatchEvent("touchend", [touch2]);

    assert.strictEqual(touchpad.isTwoFingerGesture, false);
    assert.strictEqual(touchpad.isThreeFingerGesture, false);
  });

  test("should calculate positions relative to canvas", () => {
    canvas.rect = { left: 50, top: 100 };

    const startEvents: Array<{ x: number; y: number; }> = [];
    touchpad.on("start", (_touch, position) => {
      startEvents.push({ x: position.x, y: position.y });
    });

    const touch = createTouch(0, 150, 250);
    canvas.dispatchEvent("touchstart", [touch]);

    assert.strictEqual(startEvents[0].x, 100);
    assert.strictEqual(startEvents[0].y, 150);
  });
});
