// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import {
  Mouse,
  TouchIdentifier
} from "../src/index.ts";
import { MouseEventButton } from "../src/devices/Mouse.class.ts";
import * as mocks from "./mocks/index.ts";

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

  test("isMoving reflects the current delta", () => {
    assert.strictEqual(mouse.isMoving(), false);

    mouse.newPosition = { x: 10, y: 0 };
    mouse.update();

    assert.strictEqual(mouse.isMoving(), true);
  });

  test("visible accessor toggles the canvas cursor style", () => {
    assert.strictEqual(mouse.visible, true);
    mouse.visible = false;
    assert.strictEqual(mouse.visible, false);
    mouse.visible = true;
    assert.strictEqual(mouse.visible, true);
  });

  test("viewportPosition normalizes canvas-space coordinates into [-1, 1] with Y flipped", () => {
    mouse.newPosition = { x: 800, y: 0 };
    mouse.update();

    assert.deepStrictEqual(mouse.viewportPosition, { x: 1, y: 1 });
  });

  test("worldPosition scales the viewport position by half the canvas size", () => {
    mouse.newPosition = { x: 800, y: 0 };
    mouse.update();

    assert.deepStrictEqual(mouse.worldPosition, { x: 400, y: 300 });
  });

  test("viewportDelta inverts Y, and normalizes against canvas size when requested", () => {
    mouse.newPosition = { x: 10, y: 20 };
    mouse.update();

    assert.deepStrictEqual(mouse.viewportDelta(), { x: 10, y: -20 });
    assert.deepStrictEqual(mouse.viewportDelta(true), { x: 0.025, y: -20 / 300 });
  });

  test("isDown resolves a named button, and handles ANY / NONE", () => {
    assert.strictEqual(mouse.isDown("left"), false);
    assert.strictEqual(mouse.isDown("NONE"), true);
    assert.strictEqual(mouse.isDown("ANY"), false);

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(mouse.isDown("left"), true);
    assert.strictEqual(mouse.isDown(MouseEventButton.left), true);
    assert.strictEqual(mouse.isDown("ANY"), true);
    assert.strictEqual(mouse.isDown("NONE"), false);
  });

  test("wasJustPressed / wasJustReleased resolve a named button, and handle ANY / NONE", () => {
    assert.strictEqual(mouse.wasJustPressed("NONE"), true);

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.strictEqual(mouse.wasJustPressed("ANY"), true);
    assert.strictEqual(mouse.wasJustPressed("NONE"), false);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), true);
  });

  test("preserves a complete click that occurs between input samples", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });

    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.strictEqual(mouse.wasJustReleased("left"), true);

    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), false);
    assert.strictEqual(mouse.wasJustReleased("left"), false);

    mouse.publishFrameState();

    assert.strictEqual(mouse.wasJustPressed("left"), true);
    assert.strictEqual(mouse.wasJustReleased("left"), true);

    mouse.publishFrameState();

    assert.strictEqual(mouse.wasJustPressed("left"), false);
    assert.strictEqual(mouse.wasJustReleased("left"), false);
  });

  test("publishes transitions accumulated across several input samples", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();
    mouse.update();

    assert.strictEqual(mouse.wasJustPressed("left"), false);

    mouse.publishFrameState();

    assert.strictEqual(mouse.wasJustPressed("left"), true);
  });

  test("publishes wheel and movement accumulated across samples", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 20, clientY: 10 });
    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();
    mouse.update();

    assert.deepStrictEqual(mouse.delta, { x: 0, y: 0 });
    assert.strictEqual(mouse.scrollUp, false);

    mouse.publishFrameState();

    assert.deepStrictEqual(mouse.delta, { x: 20, y: 10 });
    assert.strictEqual(mouse.scrollUp, true);
  });

  test("should handle mouse down event", () => {
    const downEvents: MouseEvent[] = [];
    mouse.on("down", (event) => {
      downEvents.push(event);
    });

    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    assert.strictEqual(downEvents.length, 1);
    assert.strictEqual(mouse.isDown(MouseEventButton.left), true);
    assert.strictEqual(canvas.focus.mock.calls.length, 1);
  });

  test("should handle mouse up event", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    const upEvents: MouseEvent[] = [];
    mouse.on("up", (event) => {
      upEvents.push(event);
    });

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });

    assert.strictEqual(upEvents.length, 1);
    assert.strictEqual(mouse.isDown(MouseEventButton.left), false);
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
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).doubleClicked, true);
  });

  test("doubleClicked is a one-frame pulse, not a permanent latch", () => {
    canvas.dispatchMouseEvent("dblclick", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).doubleClicked, true);

    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).doubleClicked, false);
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

  test("should update button states correctly", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, true);
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).wasJustPressed, true);
    assert.strictEqual(mouse.wasActive, true);

    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).wasJustPressed, false);
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, true);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, false);
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).wasJustReleased, true);
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

  test("unlock() before the lock is granted still clears the pending intent", () => {
    // The browser grants pointer lock asynchronously. Cancelling in between
    // used to leave the intent flag set, so mousemove stayed on the
    // pointer-lock branch and `position` never updated again.
    mouse.lock();
    mouse.unlock();

    canvas.dispatchMouseEvent("mousemove", { clientX: 120, clientY: 80 });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 120, y: 80 });
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

    assert.strictEqual(mouse.isDown(MouseEventButton.left), true);
  });

  test("should synchronize with primary touch for position", () => {
    const touch = createTouch(TouchIdentifier.primary, 100, 150);

    mouse.synchronizeWithTouch(touch, undefined, { x: 100, y: 150 });

    assert.deepStrictEqual(mouse.newPosition, { x: 100, y: 150 });
  });

  test("should not synchronize with non-primary touch", () => {
    const touch = createTouch(1, 100, 150);

    mouse.synchronizeWithTouch(touch, true, { x: 100, y: 150 });

    assert.strictEqual(mouse.isDown(MouseEventButton.left), false);
    assert.strictEqual(mouse.newPosition, null);
  });

  test("tracks a button index outside the seven known ones as not pressed", () => {
    canvas.dispatchMouseEvent("mousedown", { button: 9 });
    mouse.update();

    assert.strictEqual(mouse.isDown(9), false);
    assert.strictEqual(mouse.isDown("ANY"), false);
  });

  test("should handle multiple buttons pressed simultaneously", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.right });
    mouse.update();

    assert.strictEqual(mouse.buttonState(MouseEventButton.left).isDown, true);
    assert.strictEqual(mouse.buttonState(MouseEventButton.right).isDown, true);
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
    assert.strictEqual(mouse.buttonState(MouseEventButton.left).wasJustReleased, true);
  });

  test("should calculate position relative to canvas offset", () => {
    canvas.rect = { left: 100, top: 50 };

    canvas.dispatchMouseEvent("mousemove", { clientX: 250, clientY: 200 });

    assert.deepStrictEqual(mouse.newPosition, { x: 150, y: 150 });
  });

  test("does not force a layout read when the event exposes offsetX/offsetY", () => {
    canvas.rect = { left: 100, top: 50 };
    canvas.boundingClientRectCalls = 0;

    for (let i = 0; i < 50; i++) {
      canvas.dispatchMouseEvent("mousemove", { clientX: 250, clientY: 200 });
    }

    // getBoundingClientRect() forces style + layout in a real browser, at up
    // to the mouse's polling rate. offsetX/offsetY carry the same value for
    // free.
    assert.strictEqual(canvas.boundingClientRectCalls, 0);
    assert.deepStrictEqual(mouse.newPosition, { x: 150, y: 150 });
  });

  test("falls back to getBoundingClientRect() when offsets are unavailable", () => {
    canvas.rect = { left: 100, top: 50 };
    canvas.boundingClientRectCalls = 0;

    canvas.dispatchMouseEvent("mousemove", {
      clientX: 250,
      clientY: 200,
      omitOffsets: true
    });

    assert.strictEqual(canvas.boundingClientRectCalls, 1);
    assert.deepStrictEqual(mouse.newPosition, { x: 150, y: 150 });
  });

  test("a full press/release cycle still publishes every transition", () => {
    canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.isDown("left"), true);
    assert.strictEqual(mouse.wasJustPressed("left"), true);

    mouse.update();
    assert.strictEqual(mouse.wasJustPressed("left"), false);

    canvas.dispatchMouseEvent("mouseup", { button: MouseEventButton.left });
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), true);

    // The settling tick must run even though nothing is held.
    mouse.update();
    assert.strictEqual(mouse.wasJustReleased("left"), false);
    assert.strictEqual(mouse.wasActive, false);
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

  test("movement arriving after idle ticks still updates position and delta", () => {
    for (let frame = 0; frame < 20; frame++) {
      mouse.update();
    }

    canvas.dispatchMouseEvent("mousemove", { clientX: 42, clientY: 24 });
    mouse.update();

    assert.deepStrictEqual(mouse.position, { x: 42, y: 24 });
    assert.strictEqual(mouse.isMoving(), true);

    mouse.update();
    assert.strictEqual(mouse.isMoving(), false);
  });

  test("a wheel notch arriving after idle ticks is not swallowed", () => {
    for (let frame = 0; frame < 20; frame++) {
      mouse.update();
    }

    canvas.dispatchWheelEvent({ wheelDelta: 120 });
    mouse.update();

    assert.strictEqual(mouse.scrollUp, true);
  });

  test("reuses the newPosition object across events instead of reallocating", () => {
    canvas.dispatchMouseEvent("mousemove", { clientX: 10, clientY: 10 });
    const first = mouse.newPosition;

    canvas.dispatchMouseEvent("mousemove", { clientX: 20, clientY: 20 });

    assert.strictEqual(mouse.newPosition, first);
    assert.deepStrictEqual(mouse.newPosition, { x: 20, y: 20 });
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
  /** Simulates an environment that does not expose offsetX/offsetY. */
  omitOffsets?: boolean;
}

interface WheelEventData {
  wheelDelta?: number;
  wheelDeltaX?: number;
  wheelDeltaY?: number;
  detail?: number;
}

class MouseCanvasAdapter extends mocks.CanvasAdapter {
  rect = { left: 0, top: 0 };
  pointerLockElement: any = null;
  boundingClientRectCalls = 0;

  getBoundingClientRect() {
    this.boundingClientRectCalls++;

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

    // Browsers always expose offsetX/offsetY, relative to the target's box —
    // the same quantity `clientX - rect.left` computes. Emulated here so the
    // specs exercise the path a real browser takes. `omitOffsets` covers
    // environments that do not provide them, where `Mouse` falls back to
    // getBoundingClientRect().
    Object.defineProperty(event, "offsetX", {
      value: eventData.omitOffsets ?
        undefined :
        (eventData.clientX ?? 0) - this.rect.left,
      writable: false
    });
    Object.defineProperty(event, "offsetY", {
      value: eventData.omitOffsets ?
        undefined :
        (eventData.clientY ?? 0) - this.rect.top,
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
    Object.defineProperty(event, "wheelDeltaX", {
      value: eventData.wheelDeltaX ?? 0,
      writable: false
    });
    Object.defineProperty(event, "wheelDeltaY", {
      value: eventData.wheelDeltaY ?? eventData.wheelDelta ?? 0,
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
  override exitPointerLock = mock.fn();
  override pointerLockElement: any = null;

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
