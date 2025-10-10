// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Event } from "happy-dom";

// Import Internal Dependencies
import {
  Touchpad,
  TouchIdentifier,
  type TouchPosition
} from "../../src/controls/devices/index.js";
import * as mocks from "./mocks/index.js";

describe("Controls.Touchpad", () => {
  let touchpad: Touchpad;
  let canvas: TouchpadCanvasAdapter;

  beforeEach(() => {
    canvas = new TouchpadCanvasAdapter();
    touchpad = new Touchpad({ canvas });
    touchpad.connect();
  });

  afterEach(() => {
    touchpad.disconnect();
  });

  test("should initialize with default values", () => {
    assert.strictEqual(touchpad.wasActive, false);
    assert.strictEqual(touchpad.touches.length, Touchpad.MaxTouches);
    assert.strictEqual(touchpad.touchesDown.length, Touchpad.MaxTouches);

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
      startEvents.push({ touch, x: position.x, y: position.y });
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

    const state = touchpad.getTouchState(0);

    assert.strictEqual(state.isDown, true);
    assert.strictEqual(state.position.x, 50);
    assert.strictEqual(state.position.y, 75);
  });

  test("should get touch state by string identifier", () => {
    touchpad.touches[TouchIdentifier.primary].isDown = true;

    const state = touchpad.getTouchState("primary");

    assert.strictEqual(state.isDown, true);
  });

  test("should throw error for out of bounds identifier", () => {
    assert.throws(
      () => touchpad.getTouchState(-1),
      /Touch index -1 is out of bounds/
    );

    assert.throws(
      () => touchpad.getTouchState(Touchpad.MaxTouches),
      new RegExp(`Touch index ${Touchpad.MaxTouches} is out of bounds`)
    );
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

    assert.strictEqual(addEventListener.mock.calls.length, 4);
    assert.strictEqual(addEventListener.mock.calls[0].arguments[0], "touchstart");
    assert.strictEqual(addEventListener.mock.calls[1].arguments[0], "touchend");
    assert.strictEqual(addEventListener.mock.calls[2].arguments[0], "touchmove");
    assert.strictEqual(addEventListener.mock.calls[3].arguments[0], "touchcancel");

    newTouchpad.disconnect();

    assert.strictEqual(removeEventListener.mock.calls.length, 4);
    assert.strictEqual(removeEventListener.mock.calls[0].arguments[0], "touchstart");
    assert.strictEqual(removeEventListener.mock.calls[1].arguments[0], "touchend");
    assert.strictEqual(removeEventListener.mock.calls[2].arguments[0], "touchmove");
    assert.strictEqual(removeEventListener.mock.calls[3].arguments[0], "touchcancel");
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

function createTouch(
  identifier: number,
  clientX: number,
  clientY: number
): Touch {
  return {
    identifier,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
    target: null as any
  } as Touch;
}

class TouchpadCanvasAdapter extends mocks.CanvasAdapter {
  rect = { left: 0, top: 0 };

  getBoundingClientRect() {
    return this.rect;
  }

  dispatchEvent(
    type: "touchstart" | "touchend" | "touchmove" | "touchcancel",
    touches: Touch[]
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = {
      type,
      changedTouches: touches,
      target: this,
      preventDefault: () => {
        // DO NOTHING
      }
    } as unknown as Event;

    listeners.forEach((listener) => listener(event));
  }
}
