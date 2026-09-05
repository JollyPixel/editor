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
import { MouseEventButton } from "../../../src/devices/Mouse.class.ts";
import {
  createConnectedMouseFixture,
  MouseCanvasAdapter,
  MouseDocumentAdapter
} from "./Mouse.fixture.ts";

describe("Controls.Mouse pointer lock", () => {
  let mouse: Mouse;
  let canvas: MouseCanvasAdapter;
  let documentAdapter: MouseDocumentAdapter;

  beforeEach(() => {
    ({
      mouse,
      canvas,
      documentAdapter
    } = createConnectedMouseFixture());
  });

  afterEach(() => {
    mouse.disconnect();
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

    canvas.dispatchMouseEvent(
      "mousemove",
      { movementX: 5, movementY: 3 }
    );
    canvas.dispatchMouseEvent(
      "mousemove",
      { movementX: 2, movementY: -1 }
    );

    assert.deepStrictEqual(mouse.newDelta, { x: 7, y: 2 });
  });

  test("should request pointer lock on mouse down when wanted", () => {
    mouse.lock();

    canvas.dispatchMouseEvent(
      "mousedown",
      { button: MouseEventButton.left }
    );

    assert.strictEqual(
      canvas.requestPointerLock.mock.calls.length,
      1
    );
  });

  test("should not request pointer lock when already locked", () => {
    mouse.lock();
    documentAdapter.pointerLockElement = canvas;
    documentAdapter.dispatchEvent("pointerlockchange");

    canvas.dispatchMouseEvent(
      "mousedown",
      { button: MouseEventButton.left }
    );

    assert.strictEqual(
      canvas.requestPointerLock.mock.calls.length,
      0
    );
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

    assert.strictEqual(
      documentAdapter.exitPointerLock.mock.calls.length,
      1
    );
  });

  test("should not exit pointer lock when not locked", () => {
    mouse.unlock();

    assert.strictEqual(
      documentAdapter.exitPointerLock.mock.calls.length,
      0
    );
  });

  test("unlock() before the lock is granted still clears the pending intent", () => {
    mouse.lock();
    mouse.unlock();

    canvas.dispatchMouseEvent(
      "mousemove",
      { clientX: 120, clientY: 80 }
    );
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
