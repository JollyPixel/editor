// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Touchpad } from "../../../src/index.ts";
import {
  createConnectedTouchpadFixture,
  type TouchpadCanvasAdapter
} from "./Touchpad.fixture.ts";
import { createTouch } from "../../mocks/index.ts";

describe("Controls.Touchpad gestures", () => {
  let touchpad: Touchpad;
  let canvas: TouchpadCanvasAdapter;

  function touch(
    count: number
  ): void {
    canvas.dispatchTouchEvent(
      "touchstart",
      Array.from({ length: count }, (_, index) => createTouch(index, 0, 0))
    );
  }

  beforeEach(() => {
    ({
      touchpad,
      canvas
    } = createConnectedTouchpadFixture());
  });

  afterEach(() => {
    touchpad.disconnect();
  });

  test("counts the fingers on the canvas", () => {
    assert.strictEqual(touchpad.isOneFingerGesture, false);

    touch(1);
    assert.strictEqual(touchpad.isOneFingerGesture, true);
    assert.strictEqual(touchpad.isTwoFingerGesture, false);

    touch(2);
    assert.strictEqual(touchpad.isTwoFingerGesture, true);
    assert.strictEqual(touchpad.isThreeFingerGesture, false);

    touch(3);
    assert.strictEqual(touchpad.isThreeFingerGesture, true);
  });

  test("touchState() resolves numeric and named slots", () => {
    canvas.dispatchTouchEvent("touchstart", [createTouch(0, 50, 75)]);
    touchpad.update();

    assert.deepStrictEqual(touchpad.touchState(0), touchpad.touchState("primary"));
    assert.deepStrictEqual(touchpad.touchState("primary"), {
      isDown: true,
      wasStarted: true,
      wasEnded: false,
      position: {
        x: 50,
        y: 75
      }
    });
  });

  test("rejects a slot out of bounds", () => {
    assert.throws(
      () => touchpad.touchState(-1),
      /Touch index -1 is out of bounds/
    );
    assert.throws(
      () => touchpad.isDown(Touchpad.MaxTouches),
      new RegExp(`Touch index ${Touchpad.MaxTouches} is out of bounds`)
    );
  });

  test("viewportPosition normalizes canvas-space coordinates into [-1, 1] with Y flipped", () => {
    canvas.dispatchTouchEvent("touchstart", [createTouch(0, 800, 0)]);

    assert.deepStrictEqual(
      touchpad.viewportPosition(0),
      { x: 1, y: 1 }
    );
  });
});
