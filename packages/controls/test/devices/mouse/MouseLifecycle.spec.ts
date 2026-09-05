// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Mouse } from "../../../src/index.ts";
import { MouseEventButton } from "../../../src/devices/Mouse.class.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter
} from "./Mouse.fixture.ts";

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
    mouse.update();
    mouse.newPosition = { x: 100, y: 200 };
    mouse.newDelta = { x: 5, y: 10 };

    mouse.reset();

    assert.strictEqual(mouse.isDown(MouseEventButton.left), false);
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, false);
    assert.strictEqual(mouse.newPosition, null);
    assert.deepStrictEqual(mouse.newDelta, { x: 0, y: 0 });
  });

  test("visible accessor toggles the canvas cursor style", () => {
    assert.strictEqual(mouse.visible, true);
    mouse.visible = false;
    assert.strictEqual(mouse.visible, false);
    mouse.visible = true;
    assert.strictEqual(mouse.visible, true);
  });

  test("should properly connect and disconnect event listeners", () => {
    const canvasAddEventListener = mock.fn();
    const canvasRemoveEventListener = mock.fn();
    const docAddEventListener = mock.fn();
    const docRemoveEventListener = mock.fn();

    const mockCanvas = {
      addEventListener: canvasAddEventListener,
      removeEventListener: canvasRemoveEventListener
    };

    const mockDocumentAdapter = {
      addEventListener: docAddEventListener,
      removeEventListener: docRemoveEventListener
    };

    const newMouse = new Mouse({
      // @ts-expect-error
      canvas: mockCanvas, documentAdapter: mockDocumentAdapter
    });

    newMouse.connect();

    assert.strictEqual(canvasAddEventListener.mock.calls.length, 7);
    assert.strictEqual(
      canvasAddEventListener.mock.calls[0].arguments[0],
      "mousemove"
    );
    assert.strictEqual(
      canvasAddEventListener.mock.calls[1].arguments[0],
      "mousedown"
    );
    assert.strictEqual(
      canvasAddEventListener.mock.calls[2].arguments[0],
      "mouseup"
    );
    assert.strictEqual(
      canvasAddEventListener.mock.calls[3].arguments[0],
      "dblclick"
    );
    assert.strictEqual(
      canvasAddEventListener.mock.calls[4].arguments[0],
      "wheel"
    );
    assert.strictEqual(
      canvasAddEventListener.mock.calls[5].arguments[0],
      "mouseenter"
    );
    assert.strictEqual(
      canvasAddEventListener.mock.calls[6].arguments[0],
      "mouseleave"
    );

    assert.strictEqual(docAddEventListener.mock.calls.length, 4);
    assert.strictEqual(
      docAddEventListener.mock.calls[0].arguments[0],
      "mousemove"
    );
    assert.strictEqual(
      docAddEventListener.mock.calls[1].arguments[0],
      "mouseup"
    );
    assert.strictEqual(
      docAddEventListener.mock.calls[2].arguments[0],
      "pointerlockchange"
    );
    assert.strictEqual(
      docAddEventListener.mock.calls[3].arguments[0],
      "pointerlockerror"
    );

    newMouse.disconnect();

    assert.strictEqual(canvasRemoveEventListener.mock.calls.length, 7);
    assert.strictEqual(docRemoveEventListener.mock.calls.length, 4);
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
