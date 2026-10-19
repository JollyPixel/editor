// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { Screen } from "../../../src/index.ts";
import type * as mocks from "../../mocks/index.ts";
import {
  createConnectedScreenFixture,
  type ScreenDocumentAdapter
} from "./Screen.fixture.ts";

describe("Controls.Fullscreen", () => {
  let fullscreen: Screen;
  let canvas: mocks.CanvasAdapter;
  let documentAdapter: ScreenDocumentAdapter;

  beforeEach(() => {
    ({
      fullscreen,
      canvas,
      documentAdapter
    } = createConnectedScreenFixture());
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

  test("size reads the canvas client size", () => {
    assert.deepStrictEqual(fullscreen.size, { x: 800, y: 600 });
  });

  test("bounds centers the canvas size at the origin", () => {
    assert.deepStrictEqual(fullscreen.bounds, {
      left: -400,
      right: 400,
      top: 300,
      bottom: -300
    });
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

    assert.strictEqual(
      documentAdapter.exitFullscreen.mock.calls.length,
      0
    );
  });

  test("should emit stateChange event when entering fullscreen", () => {
    let emittedState: unknown;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(emittedState, "active");
    assert.strictEqual(fullscreen.wasFullscreen, true);
  });

  test("should emit stateChange event when exiting fullscreen", () => {
    fullscreen.wasFullscreen = true;
    let emittedState: unknown;
    fullscreen.on("stateChange", (state) => {
      emittedState = state;
    });

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

    documentAdapter.fullscreenElement = null;
    documentAdapter.dispatchEvent("fullscreenchange");
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(eventCount, 0);
  });

  test("should handle fullscreen error when was fullscreen", () => {
    fullscreen.wasFullscreen = true;
    let emittedState: unknown;
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

  for (const gesture of ["mousedown", "mouseup", "touchend"]) {
    test(`a ${gesture} on the canvas completes a wanted fullscreen`, () => {
      fullscreen.enter();

      canvas.dispatch(gesture, {});

      assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 1);
    });
  }

  test("a gesture requests nothing while already fullscreen", () => {
    fullscreen.enter();
    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    canvas.dispatch("mousedown", {});

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 0);
  });

  test("a gesture requests nothing until fullscreen is wanted", () => {
    canvas.dispatch("mousedown", {});

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 0);
  });

  test("disconnect() stops listening to gestures and fullscreen changes", () => {
    const states: string[] = [];
    fullscreen.on("stateChange", (state) => states.push(state));
    fullscreen.enter();
    fullscreen.disconnect();

    canvas.dispatch("mousedown", {});
    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.strictEqual(canvas.requestFullscreen.mock.calls.length, 0);
    assert.deepStrictEqual(states, []);
  });

  test("should handle multiple state changes correctly", () => {
    const states: string[] = [];
    fullscreen.on("stateChange", (state) => {
      states.push(state);
    });

    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    documentAdapter.fullscreenElement = null;
    documentAdapter.dispatchEvent("fullscreenchange");

    documentAdapter.fullscreenElement = canvas;
    documentAdapter.dispatchEvent("fullscreenchange");

    assert.deepStrictEqual(
      states,
      ["active", "suspended", "active"]
    );
  });
});
