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
  Touchpad,
  type TouchPosition
} from "../../../src/index.ts";
import {
  createConnectedTouchpadFixture,
  createTouch,
  type TouchpadCanvasAdapter
} from "./Touchpad.fixture.ts";

describe("Controls.Touchpad", () => {
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

  test("should initialize with default values", () => {
    assert.strictEqual(
      touchpad.wasActive,
      false
    );
    assert.strictEqual(
      touchpad.touches.length,
      Touchpad.MaxTouches
    );
    assert.strictEqual(
      touchpad.touchesDown.length,
      Touchpad.MaxTouches
    );

    for (let i = 0; i < Touchpad.MaxTouches; i++) {
      assert.strictEqual(touchpad.touchesDown[i], false);
      assert.deepStrictEqual(touchpad.touches[i], {
        isDown: false,
        wasStarted: false,
        wasEnded: false,
        position: { x: 0, y: 0 }
      });
    }
  });

  test("should reset all touch states", () => {
    touchpad.touchesDown[0] = true;
    touchpad.touches[0].isDown = true;
    touchpad.touches[0].position = { x: 100, y: 200 };

    touchpad.reset();

    assert.strictEqual(touchpad.touchesDown[0], false);
    assert.deepStrictEqual(touchpad.touches[0], {
      isDown: false,
      wasStarted: false,
      wasEnded: false,
      position: { x: 0, y: 0 }
    });
  });

  test("should handle touchstart event", () => {
    const startEvents: Array<{ touch: Touch; x: number; y: number; }> = [];
    touchpad.on("start", (touch, position) => {
      startEvents.push({
        touch,
        x: position.x,
        y: position.y
      });
    });

    const touch = createTouch(0, 100, 150);
    canvas.dispatchEvent("touchstart", [touch]);

    assert.strictEqual(startEvents.length, 1);
    assert.strictEqual(startEvents[0].touch.identifier, 0);
    assert.strictEqual(startEvents[0].x, 100);
    assert.strictEqual(startEvents[0].y, 150);
    assert.strictEqual(touchpad.touchesDown[0], true);
    assert.strictEqual(touchpad.touches[0].position.x, 100);
    assert.strictEqual(touchpad.touches[0].position.y, 150);
  });

  test("should handle multiple touches on touchstart", () => {
    const startEvents: Array<{ identifier: number; }> = [];
    touchpad.on("start", (touch) => {
      startEvents.push({ identifier: touch.identifier });
    });

    const touch1 = createTouch(0, 100, 150);
    const touch2 = createTouch(1, 200, 250);
    canvas.dispatchEvent("touchstart", [touch1, touch2]);

    assert.strictEqual(startEvents.length, 2);
    assert.strictEqual(touchpad.touchesDown[0], true);
    assert.strictEqual(touchpad.touchesDown[1], true);
  });

  test("should handle touchend event", () => {
    touchpad.touchesDown[0] = true;
    const endEvents: Array<{ identifier: number; }> = [];
    touchpad.on("end", (touch) => {
      endEvents.push({ identifier: touch.identifier });
    });

    const touch = createTouch(0, 100, 150);
    canvas.dispatchEvent("touchend", [touch]);

    assert.strictEqual(endEvents.length, 1);
    assert.strictEqual(endEvents[0].identifier, 0);
    assert.strictEqual(touchpad.touchesDown[0], false);
  });

  test("should handle touchcancel event", () => {
    touchpad.touchesDown[0] = true;
    const endEvents: Array<{ identifier: number; }> = [];
    touchpad.on("end", (touch) => {
      endEvents.push({ identifier: touch.identifier });
    });

    const touch = createTouch(0, 100, 150);
    canvas.dispatchEvent("touchcancel", [touch]);

    assert.strictEqual(endEvents.length, 1);
    assert.strictEqual(endEvents[0].identifier, 0);
    assert.strictEqual(touchpad.touchesDown[0], false);
  });

  test("should handle touchmove event", () => {
    touchpad.touchesDown[0] = true;
    const moveEvents: Array<TouchPosition> = [];
    touchpad.on("move", (_touch, position) => {
      moveEvents.push({ x: position.x, y: position.y });
    });

    const touch = createTouch(0, 150, 200);
    canvas.dispatchEvent("touchmove", [touch]);

    assert.strictEqual(moveEvents.length, 1);
    assert.strictEqual(moveEvents[0].x, 150);
    assert.strictEqual(moveEvents[0].y, 200);
    assert.strictEqual(touchpad.touches[0].position.x, 150);
    assert.strictEqual(touchpad.touches[0].position.y, 200);
  });

  test("should ignore touches with identifier >= MaxTouches", () => {
    const startEvents: Array<{ identifier: number; }> = [];
    touchpad.on("start", (touch) => {
      startEvents.push({ identifier: touch.identifier });
    });

    const touch = createTouch(Touchpad.MaxTouches, 100, 150);
    canvas.dispatchEvent("touchstart", [touch]);

    assert.strictEqual(startEvents.length, 0);
  });

  test("should update touch states correctly", () => {
    const touch = createTouch(0, 100, 150);
    canvas.dispatchEvent("touchstart", [touch]);

    touchpad.update();

    assert.strictEqual(touchpad.touches[0].isDown, true);
    assert.strictEqual(touchpad.touches[0].wasStarted, true);
    assert.strictEqual(touchpad.touches[0].wasEnded, false);
    assert.strictEqual(touchpad.wasActive, true);

    touchpad.update();

    assert.strictEqual(touchpad.touches[0].wasStarted, false);
    assert.strictEqual(touchpad.wasActive, true);

    canvas.dispatchEvent("touchend", [touch]);
    touchpad.update();

    assert.strictEqual(touchpad.touches[0].isDown, false);
    assert.strictEqual(touchpad.touches[0].wasEnded, true);
    assert.strictEqual(touchpad.wasActive, false);
  });
});
