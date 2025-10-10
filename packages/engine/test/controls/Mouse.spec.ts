// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { Mouse, MouseEventButton } from "../../src/controls/devices/index.js";
import { TouchIdentifier } from "../../src/controls/devices/Touchpad.class.js";
import * as mocks from "./mocks/index.js";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

describe("Controls.Mouse", () => {
  let mouse: Mouse;
  let canvas: MouseCanvasAdapter;
  let documentAdapter: MouseDocumentAdapter;

  beforeEach(() => {
    canvas = new MouseCanvasAdapter();
    documentAdapter = new MouseDocumentAdapter();
    mouse = new Mouse({
      canvas,
      documentAdapter
    });
    mouse.connect();
  });

  afterEach(() => {
    mouse.disconnect();
  });

  test("should initialize with default values", () => {
    assert.strictEqual(mouse.wasActive, false);
    assert.strictEqual(mouse.locked, false);
    assert.deepStrictEqual(mouse.position, { x: 0, y: 0 });
    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
    assert.strictEqual(mouse.buttons.length, 7);
    assert.strictEqual(mouse.buttonsDown.length, 7);

    for (let i = 0; i < 7; i++) {
      assert.deepStrictEqual(mouse.buttons[i], {
        isDown: false,
        doubleClicked: false,
        wasJustPressed: false,
        wasJustReleased: false
      });
      assert.strictEqual(mouse.buttonsDown[i], false);
    }
  });

  test("should reset mouse state correctly", () => {
    mouse.buttonsDown[MouseEventButton.left] = true;
    mouse.buttons[MouseEventButton.left].isDown = true;
    mouse.newPosition = { x: 100, y: 200 };
    mouse.newDelta = { x: 5, y: 10 };

    mouse.reset();

    assert.strictEqual(mouse.buttonsDown[MouseEventButton.left], false);
    assert.strictEqual(mouse.buttons[MouseEventButton.left].isDown, false);
    assert.strictEqual(mouse.newPosition, null);
    assert.deepStrictEqual(mouse.newDelta, { x: 0, y: 0 });
  });

  test("should handle mouse down event", () => {
    const downEvents: MouseEvent[] = [];
    mouse.on("down", (event) => {
      downEvents.push(event);
    });

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(downEvents.length, 1);
    assert.strictEqual(mouse.buttonsDown[MouseEventButton.left], true);
    assert.strictEqual(canvas.focus.mock.calls.length, 1);
  });

  test("should handle mouse up event", () => {
    mouse.buttonsDown[MouseEventButton.left] = true;

    const upEvents: MouseEvent[] = [];
    mouse.on("up", (event) => {
      upEvents.push(event);
    });

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });

    assert.strictEqual(upEvents.length, 1);
    assert.strictEqual(mouse.buttonsDown[MouseEventButton.left], false);
  });

  test("should handle mouse move event without pointer lock", () => {
    const moveEvents: MouseEvent[] = [];
    mouse.on("move", (event) => {
      moveEvents.push(event);
    });

    canvas.dispatchMouseEvent("mousemove", { clientX: 150, clientY: 200 });

    assert.strictEqual(moveEvents.length, 1);
    assert.deepStrictEqual(mouse.newPosition, { x: 150, y: 200 });
  });

  test("should handle mouse move event with pointer lock", () => {
    mouse.lock();
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    canvas.dispatchMouseEvent("mousemove", {
      movementX: 10,
      movementY: -5
    });

    assert.deepStrictEqual(mouse.newDelta, { x: 10, y: -5 });
  });

  test("should accumulate movement delta with pointer lock", () => {
    mouse.lock();
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    canvas.dispatchMouseEvent("mousemove", { movementX: 5, movementY: 3 });
    canvas.dispatchMouseEvent("mousemove", { movementX: 2, movementY: -1 });

    assert.deepStrictEqual(mouse.newDelta, { x: 7, y: 2 });
  });

  test("should handle double click event", () => {
    canvas.dispatchMouseEvent("dblclick", { button: MouseEventButton.left });

    assert.strictEqual(mouse.buttons[MouseEventButton.left].doubleClicked, true);
  });

  test("should handle wheel scroll up", () => {
    const wheelEvents: WheelEvent[] = [];
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

  test("should clear scroll state after update", () => {
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, true);

    mouse.update();

    assert.strictEqual(mouse.scrollUp, false);
  });

  test("should update button states correctly", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(mouse.buttons[MouseEventButton.left].isDown, true);
    assert.strictEqual(mouse.buttons[MouseEventButton.left].wasJustPressed, true);
    assert.strictEqual(mouse.wasActive, true);

    mouse.update();

    assert.strictEqual(mouse.buttons[MouseEventButton.left].wasJustPressed, false);
    assert.strictEqual(mouse.buttons[MouseEventButton.left].isDown, true);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(mouse.buttons[MouseEventButton.left].isDown, false);
    assert.strictEqual(mouse.buttons[MouseEventButton.left].wasJustReleased, true);
  });

  test("should calculate position delta correctly", () => {
    mouse.newPosition = { x: 100, y: 150 };
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 100, y: 150 });
    assert.deepStrictEqual(mouse.delta, { x: 100, y: 150 });

    mouse.newPosition = { x: 120, y: 160 };
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 120, y: 160 });
    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });
  });

  test("should reset delta when no new position", () => {
    mouse.newPosition = { x: 100, y: 150 };
    mouse.update();

    mouse.update();

    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
  });

  test("should request pointer lock on mouse down when wanted", () => {
    mouse.lock();

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(canvas.requestPointerLock.mock.calls.length, 1);
  });

  test("should not request pointer lock when already locked", () => {
    mouse.lock();
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(canvas.requestPointerLock.mock.calls.length, 0);
  });

  test("should emit lockStateChange event when entering pointer lock", () => {
    const lockStates: string[] = [];
    mouse.on("lockStateChange", (state) => {
      lockStates.push(state);
    });

    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    assert.deepStrictEqual(lockStates, ["locked"]);
    assert.strictEqual(mouse.locked, true);
  });

  test("should emit lockStateChange event when exiting pointer lock", () => {
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    const lockStates: string[] = [];
    mouse.on("lockStateChange", (state) => {
      lockStates.push(state);
    });

    documentAdapter.pointerLockElement = null;
    documentAdapter.dispatchEvent("pointerlockchange");

    assert.deepStrictEqual(lockStates, ["unlocked"]);
    assert.strictEqual(mouse.locked, false);
  });

  test("should handle pointer lock error", () => {
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    const lockStates: string[] = [];
    mouse.on("lockStateChange", (state) => {
      lockStates.push(state);
    });

    documentAdapter.dispatchEvent("pointerlockerror");

    assert.deepStrictEqual(lockStates, ["unlocked"]);
  });

  test("should exit pointer lock when unlock is called", () => {
    mouse.lock();
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    mouse.unlock();

    assert.strictEqual(documentAdapter.exitPointerLock.mock.calls.length, 1);
  });

  test("should not exit pointer lock when not locked", () => {
    mouse.unlock();

    assert.strictEqual(documentAdapter.exitPointerLock.mock.calls.length, 0);
  });

  test("should use delta from newDelta when pointer locked", () => {
    mouse.lock();
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    mouse.newDelta = { x: 15, y: -10 };
    mouse.update();

    assert.deepStrictEqual(mouse.delta, { x: 15, y: -10 });
    assert.deepStrictEqual(mouse.newDelta, { x: 0, y: 0 });
  });

  test("should synchronize with primary touch for button state", () => {
    const touch = createTouch(TouchIdentifier.primary, 100, 150);

    mouse.synchronizeWithTouch(touch, true);

    assert.strictEqual(mouse.buttonsDown[MouseEventButton.left], true);
  });

  test("should synchronize with primary touch for position", () => {
    const touch = createTouch(TouchIdentifier.primary, 100, 150);

    mouse.synchronizeWithTouch(touch, undefined, { x: 100, y: 150 });

    assert.deepStrictEqual(mouse.newPosition, { x: 100, y: 150 });
  });

  test("should not synchronize with non-primary touch", () => {
    const touch = createTouch(1, 100, 150);

    mouse.synchronizeWithTouch(touch, true, { x: 100, y: 150 });

    assert.strictEqual(mouse.buttonsDown[MouseEventButton.left], false);
    assert.strictEqual(mouse.newPosition, null);
  });

  test("should handle multiple buttons pressed simultaneously", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.right });
    mouse.update();

    assert.strictEqual(mouse.buttons[MouseEventButton.left].isDown, true);
    assert.strictEqual(mouse.buttons[MouseEventButton.right].isDown, true);
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

    assert.strictEqual(canvasAddEventListener.mock.calls.length, 5);
    assert.strictEqual(canvasAddEventListener.mock.calls[0].arguments[0], "mousemove");
    assert.strictEqual(canvasAddEventListener.mock.calls[1].arguments[0], "mousedown");
    assert.strictEqual(canvasAddEventListener.mock.calls[2].arguments[0], "mouseup");
    assert.strictEqual(canvasAddEventListener.mock.calls[3].arguments[0], "dblclick");
    assert.strictEqual(canvasAddEventListener.mock.calls[4].arguments[0], "wheel");

    assert.strictEqual(docAddEventListener.mock.calls.length, 2);
    assert.strictEqual(docAddEventListener.mock.calls[0].arguments[0], "pointerlockchange");
    assert.strictEqual(docAddEventListener.mock.calls[1].arguments[0], "pointerlockerror");

    newMouse.disconnect();

    assert.strictEqual(canvasRemoveEventListener.mock.calls.length, 5);
    assert.strictEqual(docRemoveEventListener.mock.calls.length, 2);
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
    assert.strictEqual(mouse.buttons[MouseEventButton.left].wasJustReleased, true);
  });

  test("should calculate position relative to canvas offset", () => {
    canvas.rect = { left: 100, top: 50 };

    canvas.dispatchMouseEvent("mousemove", { clientX: 250, clientY: 200 });

    assert.deepStrictEqual(mouse.newPosition, { x: 150, y: 150 });
  });

  test("should not emit lockStateChange when lock state has not changed", () => {
    let eventCount = 0;
    mouse.on("lockStateChange", () => {
      eventCount++;
    });

    documentAdapter.pointerLockElement = null;
    documentAdapter.dispatchEvent("pointerlockchange");
    documentAdapter.dispatchEvent("pointerlockchange");

    assert.strictEqual(eventCount, 0);
  });
});

interface MouseEventData {
  button?: number;
  clientX?: number;
  clientY?: number;
  movementX?: number;
  movementY?: number;
}

interface WheelEventData {
  wheelDelta?: number;
  detail?: number;
}

class MouseCanvasAdapter extends mocks.CanvasAdapter {
  rect = { left: 0, top: 0 };
  pointerLockElement: any = null;

  getBoundingClientRect() {
    return this.rect;
  }

  dispatchMouseEvent(
    type: "mousedown" | "mouseup" | "mousemove" | "dblclick",
    eventData: MouseEventData = {}
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = new kEmulatedBrowserWindow.MouseEvent(type, {
      button: eventData.button ?? 0,
      clientX: eventData.clientX ?? 0,
      clientY: eventData.clientY ?? 0,
      movementX: eventData.movementX ?? 0,
      movementY: eventData.movementY ?? 0,
      bubbles: true,
      cancelable: true
    });

    Object.defineProperty(event, "target", {
      value: this,
      writable: false
    });

    listeners.forEach((listener) => listener(event));
  }

  dispatchWheelEvent(
    eventData: WheelEventData = {}
  ) {
    const listeners = this.listeners.get("wheel") ?? new Set();
    const event = new kEmulatedBrowserWindow.WheelEvent("wheel", {
      bubbles: true,
      cancelable: true
    });

    Object.defineProperty(event, "wheelDelta", {
      value: eventData.wheelDelta ?? 0,
      writable: false
    });
    Object.defineProperty(event, "detail", {
      value: eventData.detail ?? 0,
      writable: false
    });

    listeners.forEach((listener) => listener(event));
  }
}

class MouseDocumentAdapter extends mocks.DocumentAdapter {
  exitPointerLock = mock.fn();
  pointerLockElement: any = null;

  dispatchEvent(
    type: "pointerlockchange" | "pointerlockerror"
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = new kEmulatedBrowserWindow.Event(type);

    listeners.forEach((listener) => listener(event));
  }
}

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
