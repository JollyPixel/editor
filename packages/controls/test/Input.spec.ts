// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Input,
  MouseEventButton
} from "../src/index.ts";
import * as mocks from "./mocks/index.ts";
import {
  createInputFixture,
  type InputFixture
} from "./helpers/input.ts";

describe("Controls.Input", () => {
  let fixture: InputFixture;
  let input: Input;

  beforeEach(() => {
    fixture = createInputFixture();
    ({ input } = fixture);
  });

  test("constructs one instance of each device, defaulting to the \"default\" preference", () => {
    assert.ok(input.mouse);
    assert.ok(input.keyboard);
    assert.ok(input.gamepad);
    assert.ok(input.touchpad);
    assert.ok(input.screen);
    assert.strictEqual(input.devicePreference, "default");
  });

  test("update() publishes the edges of every device", () => {
    fixture.press("KeyA");
    fixture.canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.right });
    fixture.canvas.dispatchTouchEvent("touchstart", [mocks.createTouch(9, 0, 0)]);
    fixture.plug().buttons[0] = {
      pressed: true,
      value: 1
    };

    input.update();

    assert.strictEqual(input.keyboard.wasJustPressed("KeyA"), true);
    assert.strictEqual(input.mouse.wasJustPressed("right"), true);
    assert.strictEqual(input.touchpad.wasStarted("primary"), true);
    assert.strictEqual(input.gamepad.wasButtonJustPressed(0, "A"), true);
    assert.strictEqual(input.wasActive, true);
  });

  test("one sample reaches the frame and the step readers once each", () => {
    fixture.press("KeyA");
    input.sample();

    input.publish("frame");
    assert.strictEqual(input.keyboard.wasJustPressed("KeyA"), true);
    input.publish("step");
    assert.strictEqual(input.keyboard.wasJustPressed("KeyA"), true);
    input.publish("step");
    assert.strictEqual(input.keyboard.wasJustPressed("KeyA"), false);
  });

  test("a touch on the canvas drives the mouse left button", () => {
    const touch = mocks.createTouch(4096, 30, 40);

    fixture.canvas.dispatchTouchEvent("touchstart", [touch]);
    input.update();
    assert.strictEqual(input.mouse.wasJustPressed("left"), true);
    assert.deepStrictEqual(input.mouse.position, { x: 30, y: 40 });

    fixture.canvas.dispatchTouchEvent("touchend", [touch]);
    input.update();
    assert.strictEqual(input.mouse.wasJustReleased("left"), true);
  });

  test("a touch completes a wanted fullscreen", () => {
    input.screen.enter();

    fixture.canvas.dispatchTouchEvent("touchend", [mocks.createTouch(0, 0, 0)]);

    assert.strictEqual(fixture.canvas.requestFullscreen.mock.calls.length, 1);
  });

  test("switches to gamepad on gamepad activity, and back to default on mouse activity", () => {
    const preferences: string[] = [];
    input.on("devicePreferenceChange", (preference) => preferences.push(preference));

    fixture.plug().buttons[0] = {
      pressed: true,
      value: 1
    };
    input.update();
    assert.strictEqual(input.devicePreference, "gamepad");

    fixture.windowAdapter.navigator.gamepads[0] = null;
    fixture.canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    input.update();

    assert.strictEqual(input.devicePreference, "default");
    assert.deepStrictEqual(preferences, ["gamepad", "default"]);
  });

  test("a window blur releases every held control", () => {
    fixture.press("KeyW");
    fixture.canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });

    fixture.windowAdapter.dispatch("blur", {});
    input.update();

    assert.strictEqual(input.keyboard.isDown("ANY"), false);
    assert.strictEqual(input.mouse.isDown("ANY"), false);
    assert.strictEqual(input.wasActive, false);
  });

  test("prevents the context menu", () => {
    const preventDefault = mock.fn();

    fixture.windowAdapter.dispatch("contextmenu", { preventDefault });

    assert.strictEqual(preventDefault.mock.calls.length, 1);
  });

  test("disconnect() stops listening to every device", () => {
    input.disconnect();

    fixture.press("KeyA");
    fixture.canvas.dispatchMouseEvent("mousedown", { button: MouseEventButton.left });
    input.update();

    assert.strictEqual(input.keyboard.isDown("ANY"), false);
    assert.strictEqual(input.mouse.isDown("ANY"), false);
  });

  test("emits exit once when the page unloads, if enabled", () => {
    const windowAdapter = new mocks.WindowAdapter();
    const local = new Input(new mocks.CanvasAdapter(), {
      enableOnExit: true,
      windowAdapter,
      documentAdapter: new mocks.DocumentAdapter()
    });
    let exits = 0;
    local.on("exit", () => exits++);

    windowAdapter.onbeforeunload?.();
    windowAdapter.onbeforeunload?.();

    assert.strictEqual(exits, 1);
    assert.strictEqual(local.exited, true);
  });

  test("vibrate() delegates to the window adapter's navigator", () => {
    const vibrate = mock.method(fixture.windowAdapter.navigator, "vibrate");

    input.vibrate([100, 50, 100]);

    assert.deepStrictEqual(vibrate.mock.calls[0].arguments, [[100, 50, 100]]);
  });
});
