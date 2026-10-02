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
import { MouseEventButton } from "../../../src/devices/mouse/Mouse.class.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter
} from "./Mouse.fixture.ts";

describe("Controls.Mouse frame sampling", () => {
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

  test("a press sampled on a frame without a step reaches the next step once", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    mouse.sample();
    mouse.publish("frame");
    assert.strictEqual(mouse.wasJustPressed("left"), true);

    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), true);

    mouse.publish("frame");
    assert.strictEqual(mouse.wasJustPressed("left"), false);

    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), false);
  });

  test("movement and wheel sampled on a frame without a step reach the next step", () => {
    canvas.dispatchMouseEvent(
      "mousemove",
      { clientX: 20, clientY: 10 }
    );
    canvas.dispatchWheelEvent({ wheelDelta: 120 });

    mouse.sample();
    mouse.publish("frame");
    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });

    mouse.update();
    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });
    assert.strictEqual(mouse.scrollUp, true);

    mouse.publish("frame");
    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
    assert.strictEqual(mouse.scrollUp, false);
  });

  test("reset() drops pending edges", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.sample();

    mouse.reset();
    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), false);
  });
});
