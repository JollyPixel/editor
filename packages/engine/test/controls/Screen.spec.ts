// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { Screen } from "../../src/controls/devices/index.js";
import * as mocks from "./mocks/index.js";

// CONSTANTS
const kEmulatedBrowserWindow = new Window();

describe("Controls.Fullscreen", () => {
  let fullscreen: Screen;
  let canvas: mocks.CanvasAdapter;
  let documentAdapter: ScreenDocumentAdapter;

  beforeEach(() => {
    canvas = new mocks.CanvasAdapter();

    documentAdapter = new ScreenDocumentAdapter();
    fullscreen = new Screen({
      canvas,
      documentAdapter
    });
    fullscreen.connect();
  });

  afterEach(() => {
    fullscreen.disconnect();
  });

  test("should initialize with default values", () => {
    assert.strictEqual(fullscreen.wantsFullscreen, false);
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should enter fullscreen mode", () => {
    fullscreen.enter();

    assert.strictEqual(fullscreen.wantsFullscreen, true);
  });

  test("should reset fullscreen state", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = true;

    fullscreen.reset();

    assert.strictEqual(fullscreen.wantsFullscreen, false);
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should exit fullscreen when canvas is in fullscreen", () => {
    documentAdapter.fullscreenElement = canvas;
    fullscreen.wasFullscreen = true;

    fullscreen.exit();

    assert.strictEqual(documentAdapter.exitFullscreen.mock.calls.length, 1);
    assert.strictEqual(fullscreen.wantsFullscreen, false);
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should not call exitFullscreen when canvas is not in fullscreen", () => {
    documentAdapter.fullscreenElement = null;

    fullscreen.exit();

    assert.strictEqual(documentAdapter.exitFullscreen.mock.calls.length, 0);
  });

  test("should emit stateChange event when entering fullscreen", () => {
    let emittedState;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

    // Simulate entering fullscreen
    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(emittedState, "active");
    assert.strictEqual(fullscreen.wasFullscreen, true);
  });

  test("should emit stateChange event when exiting fullscreen", () => {
    fullscreen.wasFullscreen = true;
    let emittedState;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

    // Simulate exiting fullscreen
    documentAdapter.fullscreenElement = null;
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(emittedState, "suspended");
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should not emit stateChange when fullscreen state has not changed", () => {
    let eventCount = 0;
    fullscreen.on("stateChange", () => {
      eventCount++;
    });

    // Simulate fullscreenchange without actual state change
    documentAdapter.fullscreenElement = null;
    documentAdapter.dispatchEvent("fullscreenchange");
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(eventCount, 0);
  });

  test("should handle fullscreen error when was fullscreen", () => {
    fullscreen.wasFullscreen = true;
    let emittedState;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

    documentAdapter.dispatchEvent("fullscreenerror");

    assert.strictEqual(emittedState, "suspended");
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should not emit stateChange on fullscreen error when was not fullscreen", () => {
    fullscreen.wasFullscreen = false;
    let eventCount = 0;
    fullscreen.on("stateChange", () => {
      eventCount++;
    });

    documentAdapter.dispatchEvent("fullscreenerror");

    assert.strictEqual(eventCount, 0);
  });

  test("should request fullscreen on mouse down when wants fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = false;

    fullscreen.onMouseDown();

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 1);
  });

  test("should not request fullscreen on mouse down when already fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = true;

    fullscreen.onMouseDown();

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 0);
  });

  test("should not request fullscreen on mouse down when not wants fullscreen", () => {
    fullscreen.wantsFullscreen = false;
    fullscreen.wasFullscreen = false;

    fullscreen.onMouseDown();

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 0);
  });

  test("should request fullscreen on mouse up when wants fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = false;

    fullscreen.onMouseUp();

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 1);
  });

  test("should not request fullscreen on mouse up when already fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = true;

    fullscreen.onMouseUp();

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 0);
  });

  test("should properly connect and disconnect event listeners", () => {
    const addEventListener = mock.fn();
    const removeEventListener = mock.fn();

    const newFullscreen = new Screen({
      canvas,
      // @ts-expect-error
      documentAdapter: {
        addEventListener,
        removeEventListener
      }
    });

    newFullscreen.connect();

    assert.strictEqual(addEventListener.mock.calls.length, 2);
    assert.strictEqual(addEventListener.mock.calls[0].arguments[0], "fullscreenchange");
    assert.strictEqual(addEventListener.mock.calls[1].arguments[0], "fullscreenerror");

    newFullscreen.disconnect();

    assert.strictEqual(removeEventListener.mock.calls.length, 2);
    assert.strictEqual(removeEventListener.mock.calls[0].arguments[0], "fullscreenchange");
    assert.strictEqual(removeEventListener.mock.calls[1].arguments[0], "fullscreenerror");
  });

  test("should handle multiple state changes correctly", () => {
    const states: string[] = [];
    fullscreen.on("stateChange", (state) => {
      states.push(state);
    });

    // Enter fullscreen
    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    // Exit fullscreen
    documentAdapter.fullscreenElement = null;
    documentAdapter.dispatchEvent("fullscreenchange");

    // Enter again
    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.deepStrictEqual(states, ["active", "suspended", "active"]);
  });
});

class ScreenDocumentAdapter extends mocks.DocumentAdapter {
  dispatchEvent(
    type: "fullscreenchange" | "fullscreenerror"
  ) {
    const listeners = this.listeners.get(type) ?? new Set();
    const event = new kEmulatedBrowserWindow.Event(type);

    listeners.forEach((listener) => listener(event));
  }
}
