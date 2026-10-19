// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Touchpad,
  type TouchPosition
} from "../../../src/index.ts";
import {
  createConnectedTouchpadFixture,
  type TouchpadCanvasAdapter
} from "./Touchpad.fixture.ts";
import { createTouch } from "../../mocks/index.ts";

describe("Controls.Touchpad", () => {
  let touchpad: Touchpad;
  let canvas: TouchpadCanvasAdapter;

  beforeEach(() => {
    ({
      touchpad,
      canvas
    } = createConnectedTouchpadFixture());
  });

  afterEach(() => {
    touchpad.disconnect();
  });

  test("starts with no touch and inactive", () => {
    assert.strictEqual(touchpad.wasActive, false);
    assert.strictEqual(touchpad.isDown(0), false);
  });

  test("a touch start, move, and end publish once each", () => {
    const touch = createTouch(0, 100, 150);
    canvas.dispatchTouchEvent("touchstart", [touch]);
    touchpad.update();
    assert.strictEqual(touchpad.isDown("primary"), true);
    assert.strictEqual(touchpad.wasStarted("primary"), true);
    assert.strictEqual(touchpad.wasActive, true);

    canvas.dispatchTouchEvent("touchmove", [createTouch(0, 120, 160)]);
    touchpad.update();
    assert.strictEqual(touchpad.wasStarted("primary"), false);
    assert.deepStrictEqual(touchpad.touchState(0).position, { x: 120, y: 160 });

    canvas.dispatchTouchEvent("touchend", [touch]);
    touchpad.update();
    assert.strictEqual(touchpad.isDown("primary"), false);
    assert.strictEqual(touchpad.wasEnded("primary"), true);
  });

  test("touchcancel ends a touch like touchend", () => {
    const touch = createTouch(0, 100, 150);
    canvas.dispatchTouchEvent("touchstart", [touch]);
    touchpad.update();

    canvas.dispatchTouchEvent("touchcancel", [touch]);
    touchpad.update();

    assert.strictEqual(touchpad.wasEnded(0), true);
  });

  test("a tap between two updates reports the start and the end", () => {
    const touch = createTouch(0, 100, 150);
    canvas.dispatchTouchEvent("touchstart", [touch]);
    canvas.dispatchTouchEvent("touchend", [touch]);
    touchpad.update();

    assert.strictEqual(touchpad.wasStarted(0), true);
    assert.strictEqual(touchpad.wasEnded(0), true);
    assert.strictEqual(touchpad.isDown(0), false);
  });

  test("touches take the lowest free slot whatever their identifier", () => {
    const first = createTouch(4096, 10, 10);
    const second = createTouch(4097, 20, 20);
    canvas.dispatchTouchEvent("touchstart", [first, second]);
    canvas.dispatchTouchEvent("touchend", [first]);
    canvas.dispatchTouchEvent("touchstart", [createTouch(4098, 30, 30)]);

    assert.strictEqual(touchpad.isDown("primary"), true);
    assert.strictEqual(touchpad.isDown("secondary"), true);
    assert.deepStrictEqual(touchpad.touchState(0).position, { x: 30, y: 30 });
    assert.deepStrictEqual(touchpad.touchState(1).position, { x: 20, y: 20 });
  });

  test("ignores touches beyond MaxTouches and their end", () => {
    const touches = Array.from(
      { length: Touchpad.MaxTouches + 1 },
      (_, index) => createTouch(index, index, index)
    );
    const ends: number[] = [];
    touchpad.on("end", (touch) => ends.push(touch.identifier));

    canvas.dispatchTouchEvent("touchstart", touches);
    canvas.dispatchTouchEvent("touchend", [touches[Touchpad.MaxTouches]]);

    assert.deepStrictEqual(ends, []);
    assert.strictEqual(touchpad.isDown(Touchpad.MaxTouches - 1), true);
  });

  test("emits start, move, and end with the canvas-relative position", () => {
    canvas.rect = { left: 50, top: 25 };
    const events: Array<[string, TouchPosition | null]> = [];
    touchpad.on("start", (_, position) => events.push(["start", { ...position }]));
    touchpad.on("move", (_, position) => events.push(["move", { ...position }]));
    touchpad.on("end", () => events.push(["end", null]));

    canvas.dispatchTouchEvent("touchstart", [createTouch(7, 150, 125)]);
    canvas.dispatchTouchEvent("touchmove", [createTouch(7, 160, 135)]);
    canvas.dispatchTouchEvent("touchend", [createTouch(7, 160, 135)]);

    assert.deepStrictEqual(events, [
      ["start", { x: 100, y: 100 }],
      ["move", { x: 110, y: 110 }],
      ["end", null]
    ]);
  });

  test("reset() releases every touch without an end", () => {
    canvas.dispatchTouchEvent("touchstart", [createTouch(0, 10, 10)]);
    touchpad.update();

    touchpad.reset();
    touchpad.update();

    assert.strictEqual(touchpad.isDown(0), false);
    assert.strictEqual(touchpad.wasEnded(0), false);
    assert.deepStrictEqual(touchpad.touchState(0).position, { x: 0, y: 0 });
  });

  test("disconnect() stops listening to touches", () => {
    touchpad.disconnect();

    canvas.dispatchTouchEvent("touchstart", [createTouch(0, 10, 10)]);

    assert.strictEqual(touchpad.isDown(0), false);
  });
});
