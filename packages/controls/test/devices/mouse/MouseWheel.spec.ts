// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  Mouse,
  ScrollSource
} from "../../../src/index.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter,
  type WheelEventData
} from "./Mouse.fixture.ts";

describe("Controls.Mouse wheel", () => {
  let mouse: Mouse;
  let canvas: MouseCanvasAdapter;

  beforeEach(() => {
    ({
      mouse,
      canvas
    } = createConnectedMouseFixture());
  });

  afterEach(() => {
    mouse.disconnect();
  });

  test("publishes wheel and movement accumulated across samples", () => {
    canvas.dispatchMouseEvent(
      "mousemove",
      { clientX: 20, clientY: 10 }
    );
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();
    mouse.update();

    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
    assert.strictEqual(mouse.scrollUp, false);

    mouse.publish("frame");

    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });
    assert.strictEqual(mouse.scrollUp, true);
  });

  test("should handle wheel scroll up", () => {
    const wheelEvents: MouseEvent[] = [];
    mouse.on("wheel", (event) => {
      wheelEvents.push(event);
    });

    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(wheelEvents.length, 1);
    assert.strictEqual(mouse.scrollUp, true);
    assert.strictEqual(mouse.scrollDown, false);
  });

  test("should handle wheel scroll down", () => {
    canvas.dispatchWheelEvent({ wheelDelta: -120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, false);
    assert.strictEqual(mouse.scrollDown, true);
  });

  test("accumulates several wheel events arriving within one frame", () => {
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, true);
    assert.strictEqual(mouse.scrollDown, false);
  });

  test("a down notch following an up notch in the same frame nets out", () => {
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    canvas.dispatchWheelEvent({ wheelDelta: -120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, false);
    assert.strictEqual(mouse.scrollDown, false);
  });

  test("should clear scroll state after update", () => {
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, true);

    mouse.update();

    assert.strictEqual(mouse.scrollUp, false);
  });

  test("publishes the wheel magnitude, not only its direction", () => {
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(mouse.scroll.y, 3);
    assert.strictEqual(mouse.isScrolling(), true);

    mouse.update();

    assert.deepStrictEqual(
      mouse.scroll,
      { x: 0, y: 0 }
    );
    assert.strictEqual(mouse.isScrolling(), false);
  });

  test("sums the notches every fixed step consumed into the frame", () => {
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();
    mouse.publish("frame");

    assert.strictEqual(mouse.scroll.y, 2);
  });

  test("writes the scroll into a caller-owned vector", () => {
    canvas.dispatchWheelEvent({ wheelDelta: -120 });
    mouse.update();

    const out = { x: 0, y: 0 };

    assert.strictEqual(mouse.scrollTo(out), out);
    assert.deepStrictEqual(out, { x: 0, y: -1 });
  });

  test("a wheel notch arriving after idle ticks is not swallowed", () => {
    for (let frame = 0; frame < 20; frame++) {
      mouse.update();
    }

    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, true);
  });
});

describe("Controls.Mouse wheel source", () => {
  let mouse: Mouse;
  let canvas: MouseCanvasAdapter;

  beforeEach(() => {
    ({
      mouse,
      canvas
    } = createConnectedMouseFixture());
  });

  afterEach(() => {
    mouse.disconnect();
  });

  function detectSource(
    eventData: WheelEventData
  ): ScrollSource | null {
    canvas.dispatchWheelEvent(eventData);
    mouse.update();

    return mouse.scrollSource;
  }

  const cases: Array<[string, WheelEventData, ScrollSource]> = [
    ["a whole notch", { wheelDeltaY: 120 }, "wheel"],
    ["a line-mode event", { wheelDeltaY: 36, deltaMode: 1 }, "wheel"],
    ["a partial notch", { wheelDeltaY: 36 }, "touchpad"],
    ["a horizontal swipe", { wheelDeltaX: -120, deltaX: 100 }, "touchpad"],
    [
      "Shift turning the wheel horizontal",
      { wheelDeltaX: -120, deltaX: 100, shiftKey: true },
      "wheel"
    ],
    ["a pinch", { wheelDeltaY: 12, ctrlKey: true }, "zoom"],
    ["Ctrl+wheel", { wheelDeltaY: 120, ctrlKey: true }, "zoom"]
  ];
  for (const [name, eventData, expected] of cases) {
    test(`reads ${name} as ${expected}`, () => {
      assert.strictEqual(detectSource(eventData), expected);
    });
  }

  test("keeps a touchpad gesture through a whole-notch event", () => {
    detectSource({ wheelDeltaY: 36, timeStamp: 0 });

    assert.strictEqual(
      detectSource({ wheelDeltaY: 120, timeStamp: 16 }),
      "touchpad"
    );
  });

  test("starts a new gesture after a pause", () => {
    detectSource({ wheelDeltaY: 36, timeStamp: 0 });

    assert.strictEqual(
      detectSource({ wheelDeltaY: 120, timeStamp: 1000 }),
      "wheel"
    );
  });

  test("clears the source once the scroll is consumed", () => {
    detectSource({ wheelDeltaY: 36 });
    mouse.update();

    assert.strictEqual(mouse.scrollSource, null);
  });

  test("keeps the source for a frame spanning several fixed steps", () => {
    canvas.dispatchWheelEvent({ wheelDeltaY: 36 });
    mouse.update();
    mouse.update();
    mouse.publish("frame");

    assert.strictEqual(mouse.scrollSource, "touchpad");
  });

  test("scrollDevice overrides detection but still reports zooms", () => {
    mouse.scrollDevice = "touchpad";
    assert.strictEqual(detectSource({ wheelDeltaY: 120 }), "touchpad");

    mouse.scrollDevice = "wheel";
    assert.strictEqual(detectSource({ wheelDeltaY: 36 }), "wheel");
    assert.strictEqual(
      detectSource({ wheelDeltaY: 12, ctrlKey: true }),
      "zoom"
    );
  });
});
