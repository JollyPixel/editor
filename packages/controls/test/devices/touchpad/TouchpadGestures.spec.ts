// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TouchIdentifier,
  Touchpad
} from "../../../src/index.ts";
import { createConnectedTouchpadFixture } from "./Touchpad.fixture.ts";

describe("Controls.Touchpad gestures", () => {
  let touchpad: Touchpad;

  beforeEach(() => {
    ({ touchpad } = createConnectedTouchpadFixture());
  });

  afterEach(() => {
    touchpad.disconnect();
  });

  test("should detect one-finger gesture", () => {
    assert.strictEqual(touchpad.isOneFingerGesture, false);

    touchpad.touchesDown[TouchIdentifier.primary] = true;

    assert.strictEqual(touchpad.isOneFingerGesture, true);
  });

  test("should detect two-finger gesture", () => {
    assert.strictEqual(touchpad.isTwoFingerGesture, false);

    touchpad.touchesDown[TouchIdentifier.primary] = true;

    assert.strictEqual(touchpad.isTwoFingerGesture, false);

    touchpad.touchesDown[TouchIdentifier.secondary] = true;

    assert.strictEqual(touchpad.isTwoFingerGesture, true);
  });

  test("should detect three-finger gesture", () => {
    assert.strictEqual(touchpad.isThreeFingerGesture, false);

    touchpad.touchesDown[TouchIdentifier.primary] = true;
    touchpad.touchesDown[TouchIdentifier.secondary] = true;

    assert.strictEqual(touchpad.isThreeFingerGesture, false);

    touchpad.touchesDown[TouchIdentifier.tertiary] = true;

    assert.strictEqual(touchpad.isThreeFingerGesture, true);
  });

  test("should get touch state by numeric identifier", () => {
    touchpad.touches[0].isDown = true;
    touchpad.touches[0].position = { x: 50, y: 75 };

    const state = touchpad.touchState(0);

    assert.strictEqual(state.isDown, true);
    assert.strictEqual(state.position.x, 50);
    assert.strictEqual(state.position.y, 75);
  });

  test("should get touch state by string identifier", () => {
    touchpad.touches[TouchIdentifier.primary].isDown = true;

    const state = touchpad.touchState("primary");

    assert.strictEqual(state.isDown, true);
  });

  test("should throw error for out of bounds identifier", () => {
    assert.throws(
      () => touchpad.touchState(-1),
      /Touch index -1 is out of bounds/
    );

    assert.throws(
      () => touchpad.touchState(Touchpad.MaxTouches),
      new RegExp(`Touch index ${Touchpad.MaxTouches} is out of bounds`)
    );
  });

  test("isDown / wasStarted / wasEnded read the matching TouchState flag", () => {
    touchpad.touches[0].isDown = true;
    touchpad.touches[0].wasStarted = true;
    touchpad.touches[0].wasEnded = false;

    assert.strictEqual(touchpad.isDown(0), true);
    assert.strictEqual(touchpad.wasStarted(0), true);
    assert.strictEqual(touchpad.wasEnded(0), false);
    assert.strictEqual(touchpad.isDown("primary"), true);
  });

  test("viewportPosition normalizes canvas-space coordinates into [-1, 1] with Y flipped", () => {
    touchpad.touches[0].position = { x: 800, y: 0 };

    assert.deepStrictEqual(
      touchpad.viewportPosition(0),
      { x: 1, y: 1 }
    );
  });
});
