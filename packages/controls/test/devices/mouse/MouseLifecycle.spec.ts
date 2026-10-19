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
import { createTouch } from "../../mocks/index.ts";

describe("Controls.Mouse lifecycle", () => {
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

  test("should initialize with default values", () => {
    assert.strictEqual(mouse.wasActive, false);
    assert.strictEqual(mouse.locked, false);
    assert.deepStrictEqual(mouse.position, { x: 0, y: 0 });
    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
    for (let i = 0; i < 7; i++) {
      assert.deepStrictEqual(mouse.buttonState(i), {
        isDown: false,
        doubleClicked: false,
        wasJustPressed: false,
        wasJustReleased: false
      });
      assert.strictEqual(mouse.isDown(i), false);
    }
  });

  test("should reset mouse state correctly", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mousemove", { clientX: 100, clientY: 200 });

    mouse.reset();
    mouse.update();

    assert.strictEqual(mouse.isDown(MouseEventButton.left), false);
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, false);
    assert.strictEqual(mouse.wasJustPressed(MouseEventButton.left), false);
    assert.deepStrictEqual(mouse.position, { x: 0, y: 0 });
    assert.strictEqual(mouse.isMoving(), false);
  });

  test("visible accessor toggles the canvas cursor style", () => {
    assert.strictEqual(mouse.visible, true);
    mouse.visible = false;
    assert.strictEqual(mouse.visible, false);
    mouse.visible = true;
    assert.strictEqual(mouse.visible, true);
  });

  test("disconnect() stops listening to the canvas", () => {
    mouse.disconnect();

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mousemove", { clientX: 10, clientY: 10 });
    canvas.dispatchTouchEvent("touchstart", [createTouch(0, 20, 20)]);
    mouse.update();

    assert.strictEqual(mouse.isDown("ANY"), false);
    assert.strictEqual(mouse.isMoving(), false);
  });

  test("should handle complete mouse interaction lifecycle", () => {
    const events: string[] = [];
    mouse.on("down", () => events.push("down"));
    mouse.on("move", () => events.push("move"));
    mouse.on("up", () => events.push("up"));

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();

    canvas.dispatchMouseEvent("mousemove", { clientX: 50, clientY: 75 });
    mouse.update();

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();

    assert.deepStrictEqual(events, ["down", "move", "up"]);
    assert.strictEqual(
      mouse.buttonState(MouseEventButton.left).wasJustReleased,
      true
    );
  });

  test("stays quiet across many idle ticks and still wakes on the next event", () => {
    for (let frame = 0; frame < 100; frame++) {
      mouse.update();
    }
    assert.strictEqual(mouse.wasActive, false);

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.right });
    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("right"), true);
    assert.strictEqual(mouse.wasActive, true);
  });
});
