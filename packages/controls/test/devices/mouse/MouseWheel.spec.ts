// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Mouse } from "../../../src/index.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter
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

    mouse.publishFrameState();

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
    // Two upward notches in the same frame must not cancel or be discarded:
    // the deltas used to be replaced rather than summed, dropping the first.
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
    mouse.publishFrameState();

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
