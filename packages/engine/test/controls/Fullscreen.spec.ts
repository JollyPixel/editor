// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Window } from "happy-dom";

// Import Internal Dependencies
import { Fullscreen } from "../../src/controls/targets/Fullscreen.class.js";

// CONSTANTS
const kWindow = new Window();

describe("Controls.Fullscreen", () => {
  let fullscreen: Fullscreen;
  let mockCanvas: {
    requestFullscreen: ReturnType<typeof mock.fn>;
  };
  let mockDocumentAdapter: MockDocumentAdapter;

  beforeEach(() => {
    mockCanvas = {
      requestFullscreen: mock.fn(() => Promise.resolve())
    };

    mockDocumentAdapter = new MockDocumentAdapter();
    fullscreen = new Fullscreen({
      // @ts-expect-error
      canvas: mockCanvas,
      documentAdapter: mockDocumentAdapter
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
    mockDocumentAdapter.fullscreenElement = mockCanvas;
    fullscreen.wasFullscreen = true;

    fullscreen.exit();

    assert.strictEqual(mockDocumentAdapter.exitFullscreen.mock.calls.length, 1);
    assert.strictEqual(fullscreen.wantsFullscreen, false);
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should not call exitFullscreen when canvas is not in fullscreen", () => {
    mockDocumentAdapter.fullscreenElement = null;

    fullscreen.exit();

    assert.strictEqual(mockDocumentAdapter.exitFullscreen.mock.calls.length, 0);
  });

  test("should emit stateChange event when entering fullscreen", () => {
    let emittedState;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

    // Simulate entering fullscreen
    mockDocumentAdapter.fullscreenElement = mockCanvas;
    mockDocumentAdapter.dispatchEvent("fullscreenchange");

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
    mockDocumentAdapter.fullscreenElement = null;
    mockDocumentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(emittedState, "suspended");
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should not emit stateChange when fullscreen state has not changed", () => {
    let eventCount = 0;
    fullscreen.on("stateChange", () => {
      eventCount++;
    });

    // Simulate fullscreenchange without actual state change
    mockDocumentAdapter.fullscreenElement = null;
    mockDocumentAdapter.dispatchEvent("fullscreenchange");
    mockDocumentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(eventCount, 0);
  });

  test("should handle fullscreen error when was fullscreen", () => {
    fullscreen.wasFullscreen = true;
    let emittedState;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

    mockDocumentAdapter.dispatchEvent("fullscreenerror");

    assert.strictEqual(emittedState, "suspended");
    assert.strictEqual(fullscreen.wasFullscreen, false);
  });

  test("should not emit stateChange on fullscreen error when was not fullscreen", () => {
    fullscreen.wasFullscreen = false;
    let eventCount = 0;
    fullscreen.on("stateChange", () => {
      eventCount++;
    });

    mockDocumentAdapter.dispatchEvent("fullscreenerror");

    assert.strictEqual(eventCount, 0);
  });

  test("should request fullscreen on mouse down when wants fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = false;

    fullscreen.onMouseDown();

    assert.strictEqual(mockCanvas.requestFullscreen.mock.calls.length, 1);
  });

  test("should not request fullscreen on mouse down when already fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = true;

    fullscreen.onMouseDown();

    assert.strictEqual(mockCanvas.requestFullscreen.mock.calls.length, 0);
  });

  test("should not request fullscreen on mouse down when not wants fullscreen", () => {
    fullscreen.wantsFullscreen = false;
    fullscreen.wasFullscreen = false;

    fullscreen.onMouseDown();

    assert.strictEqual(mockCanvas.requestFullscreen.mock.calls.length, 0);
  });

  test("should request fullscreen on mouse up when wants fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = false;

    fullscreen.onMouseUp();

    assert.strictEqual(mockCanvas.requestFullscreen.mock.calls.length, 1);
  });

  test("should not request fullscreen on mouse up when already fullscreen", () => {
    fullscreen.wantsFullscreen = true;
    fullscreen.wasFullscreen = true;

    fullscreen.onMouseUp();

    assert.strictEqual(mockCanvas.requestFullscreen.mock.calls.length, 0);
  });

  test("should properly connect and disconnect event listeners", () => {
    const newMockDocumentAdapter = new MockDocumentAdapter();
    const newFullscreen = new Fullscreen({
      // @ts-expect-error
      canvas: mockCanvas,
      documentAdapter: newMockDocumentAdapter
    });

    newFullscreen.connect();

    assert.strictEqual(newMockDocumentAdapter.addEventListener.mock.calls.length, 2);
    assert.strictEqual(newMockDocumentAdapter.addEventListener.mock.calls[0].arguments[0], "fullscreenchange");
    assert.strictEqual(newMockDocumentAdapter.addEventListener.mock.calls[1].arguments[0], "fullscreenerror");

    newFullscreen.disconnect();

    assert.strictEqual(newMockDocumentAdapter.removeEventListener.mock.calls.length, 2);
    assert.strictEqual(newMockDocumentAdapter.removeEventListener.mock.calls[0].arguments[0], "fullscreenchange");
    assert.strictEqual(newMockDocumentAdapter.removeEventListener.mock.calls[1].arguments[0], "fullscreenerror");
  });

  test("should handle multiple state changes correctly", () => {
    const states: string[] = [];
    fullscreen.on("stateChange", (state) => {
      states.push(state);
    });

    // Enter fullscreen
    mockDocumentAdapter.fullscreenElement = mockCanvas;
    mockDocumentAdapter.dispatchEvent("fullscreenchange");

    // Exit fullscreen
    mockDocumentAdapter.fullscreenElement = null;
    mockDocumentAdapter.dispatchEvent("fullscreenchange");

    // Enter again
    mockDocumentAdapter.fullscreenElement = mockCanvas;
    mockDocumentAdapter.dispatchEvent("fullscreenchange");

    assert.deepStrictEqual(states, ["active", "suspended", "active"]);
  });
});

class MockDocumentAdapter {
  #listeners = new Map();

  fullscreenElement: any = null;
  addEventListener = mock.fn((type, listener) => {
    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, new Set());
    }
    this.#listeners.get(type).add(listener);
  });

  removeEventListener = mock.fn((type, listener) => {
    this.#listeners.get(type)?.delete(listener);
  });

  exitFullscreen = mock.fn(() => Promise.resolve());

  dispatchEvent(type: string) {
    const listeners = this.#listeners.get(type) ?? new Set();
    const event = new kWindow.Event(type);

    listeners.forEach((listener: any) => {
      listener(event);
    });
  }
}
